/**
 * Reducer for CheckoutClient orchestration state (validation + navigating).
 * Keeps the component's direct state surface small.
 */

export type CheckoutAction =
  | { type: "SET_VALIDATION_ERRORS"; errors: string[] }
  | { type: "SET_NAVIGATING"; navigating: boolean };

export interface CheckoutState {
  validationErrors: string[];
  navigatingToPay: boolean;
}

export const initialCheckoutState: CheckoutState = {
  validationErrors: [],
  navigatingToPay: false,
};

export function checkoutReducer(
  state: CheckoutState,
  action: CheckoutAction,
): CheckoutState {
  switch (action.type) {
    case "SET_VALIDATION_ERRORS":
      return { ...state, validationErrors: action.errors };
    case "SET_NAVIGATING":
      return { ...state, navigatingToPay: action.navigating };
    default:
      return state;
  }
}
