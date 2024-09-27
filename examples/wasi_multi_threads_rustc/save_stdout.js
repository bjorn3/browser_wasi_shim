import { WASIFarm, Fd } from "../../dist/index.js";

await import("../node_modules/@oligami/shared-object/dist/index.js");

const term = new SharedObject.SharedObjectRef("term").proxy();

class Stdout extends Fd {
	buffer = new Uint8Array(0);

	async fd_write(data /*: Uint8Array*/) /*: {ret: number, nwritten: number}*/ {
		const new_buffer = new Uint8Array(this.buffer.length + data.length);
		new_buffer.set(this.buffer);
		new_buffer.set(data, this.buffer.length);
		this.buffer = new_buffer;

		await term.writeUtf8(data);

		return { ret: 0, nwritten: data.byteLength };
	}
}

const std_out = new Stdout();

const std_err = new Stdout();

const shared_std_out = new SharedObject.SharedObject(
	{
		get() {
			return new TextDecoder().decode(std_out.buffer);
		},
		reset() {
			std_out.buffer = new Uint8Array(0);
		},
	},
	"std_out_keep",
);

const shared_std_err = new SharedObject.SharedObject(
	{
		get() {
			return new TextDecoder().decode(std_err.buffer);
		},
		reset() {
			std_err.buffer = new Uint8Array(0);
		},
	},
	"std_err_keep",
);

const farm = new WASIFarm(undefined, std_out, std_err);

const ret = await farm.get_ref();

postMessage({ wasi_ref: ret });
