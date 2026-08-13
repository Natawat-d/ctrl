import { configureStore } from "@reduxjs/toolkit";
import auth from "./authSlice";
import markets from "./marketSlice";

export const store = configureStore({
  reducer: { auth, markets },
});
