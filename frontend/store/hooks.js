"use client";

import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { fetchMarkets, selectActiveMarket } from "./marketSlice";

// useActiveMarket returns the currently-selected site, fetching the list once
// if the store is empty. Pages key their data loads off the returned market.
export function useActiveMarket() {
  const dispatch = useDispatch();
  const items = useSelector((s) => s.markets.items);
  const active = useSelector(selectActiveMarket);
  useEffect(() => { if (!items.length) dispatch(fetchMarkets()); }, [dispatch, items.length]);
  return active;
}
