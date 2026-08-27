import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "@/lib/api";

// Token lives in localStorage (the fetch layer reads it); user + status live in
// the Redux store. persist() keeps the two in sync.
type AuthUser = { _id: string; login_id: string; role: string; display_name?: string } | null;
// error keeps RTK's SerializedError.message as-is — that field may be undefined.
type AuthState = { token: string | null; user: AuthUser; status: string; error: string | null | undefined };

function persist(token: string | null, user: AuthUser) {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem("akr_token", token);
    localStorage.setItem("akr_user", JSON.stringify(user));
  } else {
    localStorage.removeItem("akr_token");
    localStorage.removeItem("akr_user");
    localStorage.removeItem("akr_market");
  }
}

export const loginThunk = createAsyncThunk("auth/login", async ({ login_id, password }: { login_id: string; password: string }) => {
  return api("/auth/login", { method: "POST", body: JSON.stringify({ login_id, password }) });
});

const slice = createSlice({
  name: "auth",
  initialState: { token: null, user: null, status: "idle", error: null } as AuthState,
  reducers: {
    // hydrate runs on the client after mount to avoid SSR/CSR mismatch.
    hydrate(state) {
      if (typeof window === "undefined") return;
      try {
        state.token = localStorage.getItem("akr_token");
        state.user = JSON.parse(localStorage.getItem("akr_user") || "null");
      } catch { /* ignore */ }
    },
    logout(state) {
      state.token = null;
      state.user = null;
      persist(null, null);
    },
  },
  extraReducers: (b) => {
    b.addCase(loginThunk.pending, (s) => { s.status = "loading"; s.error = null; })
      .addCase(loginThunk.fulfilled, (s, a) => {
        s.status = "idle";
        s.token = a.payload.access_token;
        s.user = a.payload.user;
        persist(a.payload.access_token, a.payload.user);
      })
      .addCase(loginThunk.rejected, (s, a) => { s.status = "idle"; s.error = a.error.message; });
  },
});

export const { hydrate, logout } = slice.actions;
export const selectUser = (s) => s.auth.user;
export default slice.reducer;
