// cat alt

use std::io::BufRead;

pub fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: {} <file>", args[0]);
        std::process::exit(1);
    }

    let path = &args[1];
    let file = std::fs::File::open(path).unwrap();
    let reader = std::io::BufReader::new(file);
    for line in reader.lines() {
        println!("{}", line.unwrap());
    }
}

// rustc cat.rs --target=wasm32-wasip1
