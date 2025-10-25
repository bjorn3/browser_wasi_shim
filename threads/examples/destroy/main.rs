use std::thread;
// rustc +nightly --target wasm32-wasip1-threads main.rs -o eternal_loop.wasm
// wasm-opt -Oz eternal_loop.wasm -o eternal_loop_opt.wasm

fn sleep_ms(ms: u64) {
    fn get_time_ms() -> u128 {
        let now = std::time::SystemTime::now();
        let since_epoch = now.duration_since(std::time::UNIX_EPOCH).unwrap();
        since_epoch.as_millis()
    }

    let start = get_time_ms();
    loop {
        let now = get_time_ms();
        if now - start >= ms as u128 {
            break;
        }
        std::thread::yield_now();
    }
}

fn main() {
    println!("Starting multi-threaded eternal loop demo...");
    println!("Spawning 3 threads that will run forever until destroy() is called");

    let mut handles = vec![];

    // Spawn thread 1
    let handle1 = thread::spawn(|| {
        let mut counter = 0u64;
        loop {
            counter += 1;
            println!("Thread 1: iteration {}", counter);
            sleep_ms(100);
        }
    });
    handles.push(handle1);

    // Spawn thread 2
    let handle2 = thread::spawn(|| {
        let mut counter = 0u64;
        loop {
            counter += 1;
            println!("Thread 2: iteration {}", counter);
            sleep_ms(150);
        }
    });
    handles.push(handle2);

    // Spawn thread 3
    let handle3 = thread::spawn(|| {
        let mut counter = 0u64;
        loop {
            counter += 1;
            println!("Thread 3: iteration {}", counter);
            sleep_ms(200);
        }
    });
    handles.push(handle3);

    println!("All threads spawned, waiting for them to complete...");
    println!("(They won't complete unless destroy() terminates the workers)");

    // Main thread also loops
    let mut main_counter = 0u64;
    loop {
        main_counter += 1;
        println!("Main thread: iteration {}", main_counter);

        if main_counter % 10 == 0 {
            println!(
                "Main thread: {} iterations completed, child threads still running",
                main_counter
            );
        }

        sleep_ms(120);
    }

    // This will never be reached unless destroy() kills the workers
    // for handle in handles {
    //     handle.join().unwrap();
    // }
}
