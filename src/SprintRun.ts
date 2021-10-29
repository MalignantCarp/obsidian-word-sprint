import { WordsPerMinute } from "./settings";
import {getWordCount, secondsToMMSS} from "./utils";

import {v4 as uuidv4} from 'uuid'

export interface SprintRunStat {
	sprintLength: number;
	totalWordsWritten: number;
	averageWordsPerMinute: number;
	yellowNotices: number;
	redNotices: number;
	longestStretchNotWriting: number;
	totalTimeNotWriting: number;
	elapsedMilliseconds: number;
}

export default class SprintRun {

	id : string = uuidv4()

	rand : number;
	sprintLength : number = 25
	sprintLengthInMS : number = this.sprintLength * 60 * 1000

	sprintInterval : number
	sprintStarted : boolean = false
	lastWordTime : number = 0
	previousWordCount : number
	wordCount : number = 0
	wordsPerMinute : WordsPerMinute[] = [{
		previous: 0,
		now: 0,
	}];

	latestMinute : number = 0
	yellowNoticeCount : number = 0
	redNoticeCount : number = 0
	longestWritingStretch : number = 0
	longestStretchNotWriting : number = 0
	totalTimeNotWriting : number = 0

	yellowNoticeShown : boolean = false
	redNoticeShown : boolean = false

	elapsedMilliseconds : number = 0
	millisecondsLeft : number = 0

	status : string = "GREEN"

	private endOfSprintCallback : (sprintRunStat : SprintRunStat) => void

	constructor(sprintLength : number) {
		this.sprintLength = sprintLength
		this.sprintLengthInMS = this.sprintLength * 60 * 1000
	}

	updateSprintLength(sprintLength : number) {
		this.sprintLength = sprintLength
		this.sprintLengthInMS = this.sprintLength * 60 * 1000
	}

	getWordCountDisplay() : number {
		let wordCountDisplay : number = this.wordCount - this.previousWordCount
		return wordCountDisplay >= 0 ? wordCountDisplay : 0
	}

	typingUpdate(contents: string, filepath: string) {
		const secondsSinceLastWord = Date.now() - this.lastWordTime

		if (secondsSinceLastWord > this.longestStretchNotWriting) {
			this.longestStretchNotWriting = secondsSinceLastWord
		}
		this.totalTimeNotWriting += secondsSinceLastWord
		this.lastWordTime = Date.now()
		this.wordCount = getWordCount(contents)

		this.wordsPerMinute[this.latestMinute].now = (this.getWordCountDisplay() - this.wordsPerMinute[this.latestMinute].previous)
	}

	/**
	 * Returns true if this sprint run has been started
	 */
	isStarted(): boolean {
		return this.sprintStarted
	}

	getMiniStats() {
		return {
			secondsLeft: secondsToMMSS(this.millisecondsLeft / 1000),
			wordCount: this.getWordCountDisplay()
		}
	}

	startSprint(previousWordCount : number, update : (status : string, statusChanged : boolean) => void, endOfSprintCallback : (sprintRunStat : SprintRunStat) => void): number {
		this.endOfSprintCallback = endOfSprintCallback
		this.previousWordCount = previousWordCount
		let status = 'GREEN'
		const now = Date.now()
		this.lastWordTime = Date.now()
		this.sprintStarted = true

		// reset all the stats
		this.yellowNoticeCount = 0
		this.redNoticeCount = 0
		this.longestWritingStretch = 0
		this.longestStretchNotWriting = 0
		this.totalTimeNotWriting = 0
		this.wordsPerMinute = [{
			previous: 0,
			now: 0
		}]
		this.yellowNoticeShown = false
		this.redNoticeShown	= false

		this.sprintInterval = window.setInterval(() => {
			const currentNow = Date.now()
			this.elapsedMilliseconds = currentNow - now

			this.rand = Math.floor(Math.random() * (101));
			this.millisecondsLeft = this.sprintLengthInMS - this.elapsedMilliseconds

			const msSinceLastWord = Date.now() - this.lastWordTime

			if (Math.floor(this.elapsedMilliseconds / 1000 / 60) > this.latestMinute) {
				this.latestMinute = Math.floor(this.elapsedMilliseconds / 1000 / 60)

				this.wordsPerMinute.push({
					previous: this.getWordCountDisplay(),
					now: 0,
				})
			}

			let statusChanged = false
			if (msSinceLastWord >= 10 * 1000 && !this.yellowNoticeShown) {
				this.yellowNoticeShown = true
				this.status = 'YELLOW'
				this.yellowNoticeCount += 1
				statusChanged = true
			} else if (msSinceLastWord >= 60 * 1000 && !this.redNoticeShown) {
				this.redNoticeShown = true
				this.status = 'RED'
				this.redNoticeCount += 1
				statusChanged = true
			} else if(msSinceLastWord < 10 * 1000 && this.status !== 'GREEN') {
				this.yellowNoticeShown = false
				this.redNoticeShown = false
				this.status = 'GREEN'
				statusChanged = true
			}

			update(this.status, statusChanged)

			if (this.millisecondsLeft <= 0 && this.sprintStarted) {
				this.sprintStarted = false
				window.clearInterval(this.sprintInterval)

				// DEBUG
				console.log(this.wordsPerMinute)
				endOfSprintCallback(this.getStats())
			}
		}, 1000)

		return this.sprintInterval
	}

	/**
	 * Stop this sprint and return the latest stats
	 */
	stopSprint(): SprintRunStat {
		if (this.sprintStarted) {
			const stats = this.getStats()

			this.endOfSprintCallback(stats)
			this.sprintStarted = false
			window.clearInterval(this.sprintInterval)

			return stats
		}
		return null
	}

	getStats() : SprintRunStat {
		const averageWordsPerMinute = this.wordsPerMinute.reduce((total: number, amount: WordsPerMinute, index: number, array: WordsPerMinute[]) => {
			total += amount.now
			return total / array.length
		}, 0)

		return {
			sprintLength: this.sprintLength,
			totalWordsWritten: this.getWordCountDisplay(),
			averageWordsPerMinute: averageWordsPerMinute,
			yellowNotices: this.yellowNoticeCount,
			redNotices: this.redNoticeCount,
			longestStretchNotWriting: Math.ceil(this.longestStretchNotWriting / 1000),
			totalTimeNotWriting: Math.ceil(this.totalTimeNotWriting / 1000),
			elapsedMilliseconds: this.elapsedMilliseconds,
		} as SprintRunStat
	}
}