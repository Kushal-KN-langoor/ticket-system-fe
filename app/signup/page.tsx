"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAppDispatch } from "@/lib/redux/hooks";
import { setCredentials } from "@/lib/redux/slices/authSlice";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    // Open eye — password visible, click to hide
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    // Closed/crossed eye — password hidden, click to show
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.7 19.7 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a19.6 19.6 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

const DEPARTMENT_OPTIONS = [
  "HR",
  "Hardware",
  "Software",
  "Project Management",
  "Finance",
  "Sales",
  "Marketing",
  "IT Support",
  "Operations",
  "Legal",
];

export default function SignupPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  // Fixed role sent on every signup — change this constant if the app
  // ever needs to signup a different role from this form.
  const DEFAULT_ROLE = "User";

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    departments: [] as string[],
  });
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deptOpen, setDeptOpen] = useState(false);
  const deptRef = useRef<HTMLDivElement>(null);

  // Close the department dropdown when clicking anywhere outside it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (deptRef.current && !deptRef.current.contains(event.target as Node)) {
        setDeptOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDepartment = (dept: string) => {
    setForm((f) => ({
      ...f,
      departments: f.departments.includes(dept)
        ? f.departments.filter((d) => d !== dept)
        : [...f.departments, dept],
    }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = "First name is required.";
    if (!form.lastName.trim()) e.lastName = "Last name is required.";
    if (!form.email.trim()) e.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email address.";
    if (!form.password) e.password = "Password is required.";
    else if (form.password.length < 8) e.password = "Password must be at least 8 characters.";
    if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match.";
    if (form.departments.length === 0) e.department = "Select at least one department.";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length) { setErrors(e2); return; }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    const name = `${form.firstName.trim()} ${form.lastName.trim()}`;
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email: form.email.trim(),
        password: form.password,
        role: DEFAULT_ROLE,
        // NOTE: backend was only confirmed to accept a single department
        // string (e.g. "department": "Project Management"). Since multiple
        // departments can now be picked, they're joined into one string here.
        // If the backend instead expects an array, change this line to:
        //   department: form.departments,
        department: form.departments.join(", "),
      }),
    });
    setLoading(false);
    const result = await response.json();

    if (!response.ok || !result.accessToken) {
      let message = result?.message || result?.error || "Signup failed.";
      if (response.status === 409) {
        message = "An account with this email already exists. Please sign in instead.";
      }
      setErrors({ email: message });
    } else {
      dispatch(
        setCredentials({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          user: result.user,
        })
      );
      router.push("/dashboard");
    }
  };

  const field = (key: keyof typeof form, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="min-h-screen .bg-gradient-to-br from-violet-50 via-slate-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl shadow-violet-100 border border-violet-100 p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-200">
              <i className="fi fi-rr-layers text-2xl text-white" ></i>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Create Account</h1>
            <p className="text-sm text-slate-500 mt-1">Join HelpDesk Pro today</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* First Name + Last Name side by side */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                  First Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <i className="fi fi-rr-user text-base absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => field("firstName", e.target.value)}
                    placeholder="First name"
                    className={`w-full pl-9 pr-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 ${errors.firstName ? "border-red-300 bg-red-50" : "border-slate-200"}`}
                  />
                </div>
                {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
              </div>

              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <i className="fi fi-rr-user text-base absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) => field("lastName", e.target.value)}
                    placeholder="Last name"
                    className={`w-full pl-9 pr-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 ${errors.lastName ? "border-red-300 bg-red-50" : "border-slate-200"}`}
                  />
                </div>
                {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <i className="fi fi-rr-envelope text-base absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => field("email", e.target.value)}
                  placeholder="you@example.com"
                  className={`w-full pl-9 pr-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 ${errors.email ? "border-red-300 bg-red-50" : "border-slate-200"}`}
                />
              </div>
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>

            {/* Department (multi-select checkbox dropdown) */}
            <div ref={deptRef}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Department <span className="text-red-500">*</span>
                </label>
                {form.departments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, departments: [] }))}
                    className="text-xs text-violet-600 hover:text-violet-800 font-medium"
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div className="relative">
                <i className="fi fi-rr-briefcase text-base absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10"></i>

                <button
                  type="button"
                  onClick={() => setDeptOpen((o) => !o)}
                  className={`w-full min-h-[42px] pl-9 pr-9 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white text-left transition-colors ${errors.department ? "border-red-300 bg-red-50" : deptOpen ? "border-violet-400" : "border-slate-200"}`}
                >
                  {form.departments.length === 0 ? (
                    <span className="text-slate-400">Select department(s)</span>
                  ) : (
                    <span className="flex flex-wrap gap-1.5">
                      {form.departments.map((dept) => (
                        <span
                          key={dept}
                          className="inline-flex items-center gap-1 bg-violet-100 text-violet-700 text-xs font-medium pl-2 pr-1 py-1 rounded-md"
                        >
                          {dept}
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              toggleDepartment(dept);
                            }}
                            className="w-4 h-4 flex items-center justify-center rounded hover:bg-violet-200 text-violet-500"
                          >
                            ×
                          </span>
                        </span>
                      ))}
                    </span>
                  )}
                </button>

                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-transform ${deptOpen ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>

                {deptOpen && (
                  <div className="absolute z-10 mt-1.5 w-full max-h-64 overflow-y-auto border border-slate-200 rounded-lg bg-white shadow-lg py-1.5 px-1">
                    {DEPARTMENT_OPTIONS.map((dept) => {
                      const checked = form.departments.includes(dept);
                      return (
                        <label
                          key={dept}
                          className={`flex items-center gap-2.5 px-2.5 py-2.5 my-0.5 text-sm rounded-md cursor-pointer transition-colors ${checked ? "bg-violet-50" : "hover:bg-slate-50"}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleDepartment(dept)}
                            className="sr-only"
                          />
                          <span
                            className={`w-4.5 h-4.5 shrink-0 rounded-[5px] border-2 flex items-center justify-center transition-all duration-150 ${checked ? "bg-violet-600 border-violet-600 scale-105" : "border-slate-300 bg-white"}`}
                          >
                            {checked && (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="white"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="w-3 h-3"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </span>
                          <span className={checked ? "text-violet-700 font-medium" : "text-slate-700"}>{dept}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              {errors.department && <p className="text-xs text-red-500 mt-1">{errors.department}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <i className="fi fi-rr-lock text-base absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => field("password", e.target.value)}
                  placeholder="Min. 8 characters"
                  className={`w-full pl-9 pr-10 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 ${errors.password ? "border-red-300 bg-red-50" : "border-slate-200"}`}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <EyeIcon open={showPw} />
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <i className="fi fi-rr-lock text-base absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  type={showConfirmPw ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={(e) => field("confirmPassword", e.target.value)}
                  placeholder="Repeat your password"
                  className={`w-full pl-9 pr-10 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 ${errors.confirmPassword ? "border-red-300 bg-red-50" : "border-slate-200"}`}
                />
                <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <EyeIcon open={showConfirmPw} />
                </button>
              </div>
              {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-semibold py-2.5 rounded-lg transition-all text-sm shadow-md shadow-violet-200 mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            Already have an account?{" "}
            <Link href="/" className="text-violet-600 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}