import { FormEvent, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";

const initialForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const AccountSettings = () => {
  const { user, logout } = useAuth();
  const [formData, setFormData] = useState(initialForm);
  const [showPassword, setShowPassword] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user?.id) {
      setError("Unable to identify the current user. Please sign in again.");
      return;
    }

    if (
      !formData.currentPassword ||
      !formData.newPassword ||
      !formData.confirmPassword
    ) {
      setError("Please complete all password fields.");
      return;
    }

    if (formData.newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      setError("New password must be different from the current password.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: formData.currentPassword,
      });

      if (signInError) {
        setError("Current password is incorrect.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      try {
        await supabase.from("audit_logs").insert([
          {
            user_id: user.id,
            action_type: "CHANGE_PASSWORD",
            entity_type: "USER",
            entity_id: user.id,
            description: `Changed password for ${user.email}`,
          },
        ]);
      } catch (auditError) {
        console.error("Error writing password change audit log:", auditError);
      }

      setFormData(initialForm);
      alert("Password updated successfully. Please sign in again.");
      logout();
      window.location.href = "/login";
      return;
    } catch (submitError) {
      console.error("Error updating password:", submitError);
      setError("Failed to update password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100/80 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
              <ShieldCheck className="h-4 w-4" />
              Account security
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Change your password
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Update the password for your current company admin account. This
                change is applied directly to your record in the users table.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Signed in as
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {user?.full_name || "Current User"}
            </p>
            <p className="text-sm text-slate-500">{user?.email || "-"}</p>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleChangePassword}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Password details
            </h2>
            <p className="text-sm text-slate-500">
              Enter your current password, then choose a new one.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Current password
            </span>
            <div className="relative">
              <input
                type={showPassword.currentPassword ? "text" : "password"}
                value={formData.currentPassword}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    currentPassword: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                placeholder="Enter your current password"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() =>
                  setShowPassword((current) => ({
                    ...current,
                    currentPassword: !current.currentPassword,
                  }))
                }
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-slate-600"
                aria-label={
                  showPassword.currentPassword
                    ? "Hide current password"
                    : "Show current password"
                }
              >
                {showPassword.currentPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </label>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            Use at least 6 characters and avoid reusing the current password.
          </div>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              New password
            </span>
            <div className="relative">
              <input
                type={showPassword.newPassword ? "text" : "password"}
                value={formData.newPassword}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    newPassword: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                placeholder="Enter a new password"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() =>
                  setShowPassword((current) => ({
                    ...current,
                    newPassword: !current.newPassword,
                  }))
                }
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-slate-600"
                aria-label={
                  showPassword.newPassword
                    ? "Hide new password"
                    : "Show new password"
                }
              >
                {showPassword.newPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Confirm new password
            </span>
            <div className="relative">
              <input
                type={showPassword.confirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                placeholder="Re-enter the new password"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() =>
                  setShowPassword((current) => ({
                    ...current,
                    confirmPassword: !current.confirmPassword,
                  }))
                }
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-slate-600"
                aria-label={
                  showPassword.confirmPassword
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
              >
                {showPassword.confirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </label>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Update password"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AccountSettings;
