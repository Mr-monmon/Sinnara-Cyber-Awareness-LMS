import { useAuth } from "../contexts/AuthContext";

const InactivatedSubscription = () => {
  const { logout } = useAuth();
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm h-screen flex items-center justify-center flex-col gap-4">
      <h3 className="text-lg font-semibold text-slate-900">
        In-activated Subscription
      </h3>
      <p className="text-slate-600">
        Your subscription has expired. Please contact support to activate your
        subscription.
      </p>
      <button className="bg-blue-500 text-white px-4 py-2 rounded-md" onClick={logout}>Logout</button>
    </div>
  );
};

export default InactivatedSubscription;