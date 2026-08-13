import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "@/lib/api";

export const fetchMarkets = createAsyncThunk("markets/fetch", async () => {
  return (await api("/markets")).items || [];
});

const slice = createSlice({
  name: "markets",
  initialState: { items: [], activeId: null, status: "idle" },
  reducers: {
    setActive(state, a) {
      state.activeId = a.payload;
      if (typeof window !== "undefined") {
        if (a.payload) localStorage.setItem("akr_market", a.payload);
        else localStorage.removeItem("akr_market");
      }
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchMarkets.pending, (s) => { s.status = "loading"; })
      .addCase(fetchMarkets.fulfilled, (s, a) => {
        s.status = "idle";
        s.items = a.payload;
        if (!s.activeId || !a.payload.some((m) => String(m._id) === String(s.activeId))) {
          const saved = typeof window !== "undefined" ? localStorage.getItem("akr_market") : null;
          s.activeId = a.payload.find((m) => String(m._id) === String(saved))?._id || a.payload[0]?._id || null;
        }
      });
  },
});

export const { setActive } = slice.actions;
export const selectActiveMarket = (s) =>
  s.markets.items.find((m) => String(m._id) === String(s.markets.activeId)) || s.markets.items[0] || null;
export default slice.reducer;
