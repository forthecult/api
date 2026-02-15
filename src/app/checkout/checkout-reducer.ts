/**
 * Reducer for CheckoutClient orchestration state (validation + navigating).
 * Keeps the component's direct state surface small.
 */

export type CheckoutAction =
  | { errors: string[]; type: "SET_VALIDATION_ERRORS" }
  | { navigating: boolean; type: "SET_NAVIGATING" };

export interface CheckoutState {
  navigatingToPay: boolean;
  validationErrors: string[];
}

export const initialCheckoutState: CheckoutState = {
  navigatingToPay: false,
  validationErrors: [],
};

export function checkoutReducer(
  state: CheckoutState,
  action: CheckoutAction,
): CheckoutState {
  switch (action.type) {
    case "SET_NAVIGATING":
      return { ...state, navigatingToPay: action.navigating };
    case "SET_VALIDATION_ERRORS":
      return { ...state, validationErrors: action.errors };
    default:
      return state;
  }
}
