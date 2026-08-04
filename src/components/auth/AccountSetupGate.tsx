import { ReactNode } from "react";

import { useAuth } from "../../contexts/AuthContext";
import { ForcePasswordChangeModal } from "./ForcePasswordChangeModal";
import { TwoFactorSetupModal } from "./TwoFactorSetupModal";

/**
 * AccountSetupGate — holds an account on its outstanding onboarding steps.
 *
 * The mandated order for a first sign-in is: change the emailed password, enrol
 * a second factor, then the platform. Both steps used to be enforced purely as
 * local state on the login page, which meant they lasted exactly as long as the
 * user stayed on it. Pressing refresh on the "change your password" screen, or
 * opening a dashboard URL in a second tab, restored the session with both gates
 * cleared — and the employee was inside, still holding the password that had
 * been emailed to them, with no second factor.
 *
 * Wrapping the protected routes moves the gate from "a screen you happen to be
 * on" to "a property of the account". `AuthContext` re-derives both flags on
 * every session restore, so a reload lands right back here.
 *
 * This is a UI escort, not an authorisation boundary — the data behind it is
 * protected by RLS regardless. What it guarantees is that the two steps cannot
 * be quietly skipped.
 */
export const AccountSetupGate = ({ children }: { children: ReactNode }) => {
  const { forcePasswordChange, mfaSetupRequired } = useAuth();

  if (forcePasswordChange) {
    return (
      <ForcePasswordChangeModal
        /*
         * `mfaEnforced` is deliberately NOT passed.
         *
         * That prop makes the modal chain into enrolment itself. Here the gate
         * already does the chaining — clearing `forcePasswordChange` re-renders
         * it, and the `mfaSetupRequired` branch below takes over — so passing it
         * too would have both components mounting a TOTP step at the same moment
         * over the same enrolment. One owner of the sequence, not two.
         */
        onComplete={() => {
          /* No navigation: the flags are cleared in AuthContext, this gate
             re-renders, and once both are down the children render in place. */
        }}
      />
    );
  }

  if (mfaSetupRequired) {
    return <TwoFactorSetupModal onComplete={() => { /* flag cleared in context */ }} />;
  }

  return <>{children}</>;
};

export default AccountSetupGate;
