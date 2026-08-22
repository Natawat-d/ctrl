"use client";

import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { fetchMarkets, selectActiveMarket } from "./marketSlice";
import type { RootState, AppDispatch } from "./index";

// hook ที่ผูกชนิดกับ store แล้ว — ใช้แทน useDispatch/useSelector ดิบทุกที่
// (useDispatch ดิบไม่รู้จัก thunk จึงฟ้อง AsyncThunkAction ไม่ใช่ UnknownAction)
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector = <T,>(fn: (s: RootState) => T) => useSelector(fn);

// useActiveMarket returns the currently-selected site, fetching the list once
// if the store is empty. Pages key their data loads off the returned market.
export function useActiveMarket() {
  const dispatch = useAppDispatch();
  const items = useAppSelector((s) => s.markets.items);
  const active = useAppSelector(selectActiveMarket);
  useEffect(() => { if (!items.length) dispatch(fetchMarkets()); }, [dispatch, items.length]);
  return active;
}
