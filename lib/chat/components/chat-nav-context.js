"use client";
import { createContext, useContext } from "react";
const ChatNavContext = createContext(null);
const ChatNavProvider = ChatNavContext.Provider;
function useChatNav() {
  return useContext(ChatNavContext);
}
export {
  ChatNavProvider,
  useChatNav
};
