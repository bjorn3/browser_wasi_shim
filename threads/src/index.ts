import { WASIFarmAnimal } from "./animals.ts";
import { WASIFarm } from "./farm.ts";
import { WASIFarmRef } from "./ref.ts";
export { thread_spawn_on_worker } from "./shared_array_buffer/index.ts";
export { WASIFarm, WASIFarmRef, WASIFarmAnimal };
const worker_background_worker_url: string =
  "./dist/worker_background_worker.min.ts";
export { worker_background_worker_url };
