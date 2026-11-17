import apiRequest from "./client";

const feedbackRatingsPath = "/api/rating/feedback";

export function fetchRatingFeedback(bookingId, token) {
  return apiRequest(
    `${feedbackRatingsPath}/${encodeURIComponent(bookingId)}/${encodeURIComponent(token)}`
  );
}

export function submitRatingFeedback(bookingId, token, rating) {
  return apiRequest(
    `${feedbackRatingsPath}/${encodeURIComponent(bookingId)}/${encodeURIComponent(token)}`,
    { method: "POST", body: JSON.stringify(rating) }
  );
}
