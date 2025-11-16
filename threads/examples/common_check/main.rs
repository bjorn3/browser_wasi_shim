// https://doc.rust-lang.org/book/ch16-02-message-passing.html
// rustc +nightly --target wasm32-wasip1-threads main.rs -o common.wasm -Cstrip=debuginfo -Clto=fat
// wasm-opt -Oz --enable-multivalue -o common_opt.wasm common.wasm

use std::thread;

fn main() {
    let args = std::env::args().collect::<Vec<_>>();
    match args[0].as_str() {
        "unreachable" => {
            unreachable!();
        }
        "unreachable_child" => {
            thread::spawn(|| {
                unreachable!();
            });
            loop {}
        }
        "exit" => {
            println!("exit {}", args[1]);
            std::process::exit(args[1].parse().unwrap());
        }
        "exit_child" => {
            thread::spawn(move || {
                println!("exit {}", args[1]);
                std::process::exit(args[1].parse().unwrap());
            });
            loop {}
        }
        "panic" => {
            panic!("panic!");
        }
        "panic_child" => {
            thread::spawn(|| {
                panic!("panic!");
            });
            loop {}
        }
        "ok" => {
            println!("ok");
        }
        "ok_child" => {
            thread::spawn(|| {
                println!("ok");
            })
            .join()
            .unwrap();
        }
        _ => unreachable!(),
    }
}
