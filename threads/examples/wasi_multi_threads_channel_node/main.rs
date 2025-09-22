// https://doc.rust-lang.org/book/ch16-02-message-passing.html
// rustc +nightly --target wasm32-wasip1-threads main.rs -o channel.wasm

use std::sync::mpsc;
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel();

    thread::spawn(move || {
        println!("Thread: sleeping for 5 seconds...");
        let val = String::from("hi");

        std::thread::sleep(std::time::Duration::from_secs(5));

        tx.send(val).unwrap();
    });

    let received = rx.recv().unwrap();
    println!("Got: {received}");
}
