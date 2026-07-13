export class ReportPlaceDailyLimitError extends Error {
  constructor(
    message = "You already submitted a report for this merchant today. Try again tomorrow.",
  ) {
    super(message);
    this.name = "ReportPlaceDailyLimitError";
  }
}
