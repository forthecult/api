/** Days after last delivered order before a shopper can enter the win-back funnel. */
export const WIN_BACK_IDLE_DAYS = 60;

/** Do not create a new `win_back_3` enrollment if one was created in this window (any outcome). */
export const WIN_BACK_FUNNEL_COOLDOWN_DAYS = 120;

/** First drip send after enrollment. */
export const WIN_BACK_FIRST_SEND_DELAY_MS = 24 * 60 * 60 * 1000;
