// https://doc.rust-lang.org/book/ch16-02-message-passing.html
// rustc +nightly --target wasm32-wasip1-threads main.rs -o channel_base.wasm -Cstrip=debuginfo -Clto=fat
// wasm-opt -Oz --enable-multivalue -o channel.wasm channel_base.wasm

use std::sync::mpsc;
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel();

    thread::spawn(move || {
        let val = String::from("hi");
        tx.send(val).unwrap();
    });

    let received = rx.recv().unwrap();
    println!("Got: {received}");
}
