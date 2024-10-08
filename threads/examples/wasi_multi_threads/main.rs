fn main() {
    println!("Hello, world!");

    let _: std::thread::JoinHandle<()> = std::thread::spawn(|| {
        for i in 1..1000 {
            println!("hi number {} from the spawned thread!", i);
        }
    });

    for i in 1..1000 {
        println!("hi number {} from the main thread!", i);
    }
}
