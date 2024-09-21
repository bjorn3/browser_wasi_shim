import { thread_spawn_on_worker } from "../../dist/index.js";

self.onmessage = async (event) => {
	await thread_spawn_on_worker(event.data);
};
