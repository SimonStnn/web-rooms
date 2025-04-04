"use strict";
const PORT = 8080;
const WS_URL = `ws://localhost:${PORT}`;
const CLIENT_COOKIE_NAME = "jwt";
let ws;
let jwt = null;
let rooms = [];
let room = null;
let clientName;
let refresh_interval = null;
const elements = {
    // aside
    room: document.getElementById("room"),
    room_list: document.getElementById("rooms"),
    input_join_room: document.getElementById("join-room-text"),
    button_leave_room: document.getElementById("leave-room"),
    button_join_room: document.getElementById("join-room"),
    // main
    messages: document.getElementById("messages"),
    main_input: document.getElementById("main-input"),
    // footer
    li_jwt: document.getElementById("jwt"),
    li_client: document.getElementById("client-name"),
    button_sign_out: document.getElementById("sign-out"),
    // dialog
    dialog: document.getElementById("username-dialog"),
};
function send(event, data = {}) {
    ws.send(JSON.stringify({
        event,
        ...data,
        jwt: jwt ? jwt : undefined,
    }));
    console.debug(">>>", event, data);
}
function update_room_status() {
    const in_room = room !== null;
    if (in_room) {
        console.info("You are in room:", room);
        elements.room.innerText = `You are in room: ${room}`;
    }
    else {
        console.info("You are not in a room");
        elements.room.innerText = "You are not in a room";
    }
    // Disable elements
    elements.button_leave_room.disabled = !in_room;
    elements.button_join_room.disabled = in_room;
    elements.input_join_room.disabled = in_room;
    elements.main_input.disabled = !in_room;
    // Hide elements
    elements.button_leave_room.hidden = !in_room;
    elements.button_join_room.hidden = in_room;
    elements.input_join_room.hidden = in_room;
    // Clear messages
    elements.messages.innerHTML = "";
}
function render_message(from, content) {
    const li = document.createElement("li");
    li.classList.add("message");
    const title = document.createElement("span");
    title.innerText = from;
    const text = document.createElement("p");
    text.innerText = content;
    li.appendChild(title);
    li.appendChild(text);
    elements.messages.appendChild(li);
    li.setAttribute("data-time", new Date().toISOString());
    // Scroll to bottom
    elements.messages.scrollTop = elements.messages.scrollHeight;
}
function render_room(room) {
    const li = document.createElement("li");
    li.innerText = room;
    li.addEventListener("click", () => {
        if (room)
            send("leave_room");
        send("join_room", { room });
    });
    elements.room_list.appendChild(li);
}
function on_ws_open(event) {
    console.log("Connected to", WS_URL);
    elements.li_client.innerText = "Client: " + clientName;
    send("register", { name: clientName });
    refresh_interval = setInterval(() => {
        console.log("Refreshing JWT", jwt);
        // send("register", { name: clientName });
    }, 1000);
}
function on_ws_message(event) {
    try {
        const content = event.data.toString();
        const response = JSON.parse(content);
        console.debug("<<<", response.event, response.data);
        if (response.jwt) {
            jwt = response.jwt;
            elements.li_jwt.innerText = "JWT: " + jwt;
            // Decode jwt
            const decoded = JSON.parse(atob(jwt.toString().split(".")[1]));
            console.log("Decoded JWT:", decoded);
            // Store JWT in Cookie
            // Cookies.set("jwt", jwt); // Can't get types to work
            const expirationDate = new Date(decoded.exp * 1000);
            document.cookie = `${CLIENT_COOKIE_NAME}=${jwt}; expires=${expirationDate.toUTCString()}; path=/`;
        }
        switch (response.event) {
            case "register":
                send("get_room", {});
                send("get_rooms", {});
                break;
            case "room":
                room = response.data;
                update_room_status();
                render_message("Server", `You are in room: ${room}`);
                break;
            case "rooms":
                console.info("Rooms:", response.data);
                elements.room_list.innerHTML = "";
                for (const room of response.data)
                    render_room(room);
                break;
            case "message":
                console.info(`${response.data.from}: ${response.data.content}`);
                render_message(response.data.from, response.data.content);
                break;
            case "error":
                console.error("Error:", response.data);
                break;
            default:
                console.error("Unknown event", response.event);
                break;
        }
    }
    catch (error) {
        console.error("Error parsing response:", error);
    }
}
function on_ws_close(event) {
    console.log("Disconnected from", WS_URL);
    // Try to reconnect
    const interval = setInterval(() => {
        if (ws.readyState === ws.CLOSED)
            ws = new WebSocket(WS_URL);
        else
            clearInterval(interval);
    }, 1000);
    if (refresh_interval)
        clearInterval(refresh_interval);
}
function join_room() {
    const input = elements.input_join_room;
    if (input.value) {
        send("join_room", { room: input.value });
        input.value = "";
    }
}
elements.button_join_room.addEventListener("click", join_room);
elements.input_join_room.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        join_room();
    }
});
elements.button_leave_room.addEventListener("click", (event) => {
    if (!room)
        return;
    send("leave_room", {});
});
elements.main_input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        const input = elements.main_input;
        if (input.value) {
            send("message", { data: input.value });
            input.value = "";
        }
    }
});
function setup_ws() {
    ws = new WebSocket(WS_URL);
    ws.onopen = on_ws_open;
    ws.onmessage = on_ws_message;
    ws.onclose = on_ws_close;
}
elements.dialog.addEventListener("submit", (event) => {
    event.preventDefault();
    elements.dialog.open = false;
    const form = event.target;
    const input = form.elements.namedItem("username");
    if (!input)
        return console.error("Input not found");
    clientName = input.value;
    setup_ws();
});
elements.button_sign_out.addEventListener("click", (event) => {
    document.cookie = `${CLIENT_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
    window.location.reload();
});
document.addEventListener("DOMContentLoaded", () => {
    const jwt = document.cookie
        .split(";")
        .find((c) => c.startsWith(`${CLIENT_COOKIE_NAME}=`));
    if (!jwt) {
        elements.dialog.open = true;
        return;
    }
    console.log("Found JWT in cookie:", jwt);
    const decoded = JSON.parse(atob(jwt.toString().split(".")[1]));
    console.log("Decoded JWT:", decoded);
    clientName = decoded.name;
    setup_ws();
});
console.log("Script loaded");
