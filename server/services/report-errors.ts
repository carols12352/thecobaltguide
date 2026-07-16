import { ServiceError } from "@/server/services/service-error";

export class ReportPlaceDailyLimitError extends ServiceError {
  constructor(
    message = "You already submitted a report for this merchant today. Try again tomorrow.",
  ) {
    super("CONFLICT", message, 409);
    this.name = "ReportPlaceDailyLimitError";
  }
}
