import { WS_URL } from "@/const";
import state from "@/controller/state";
import { send } from "@/controller/websocket";

export default function on_ws_open(event: Event) {
  console.info("Connected to", WS_URL);

  if (!state.clientName) {
    throw new Error("Client name is required");
  }
  $("#client-name").text(state.clientName);
  $("#client-name-info").text(state.clientName);
  send("register", { name: state.clientName });

  state.refreshInterval = setInterval(() => {
    if (state.ws.readyState !== state.ws.OPEN) return;
    if (!state.clientName) return console.warn("Client name is required");
    send("register", { name: state.clientName });
  }, 60 * 1000);
}
