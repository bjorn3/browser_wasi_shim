fn main() {
    // ファイル名を受けとる
    let args: Vec<String> = std::env::args().collect();
    let filename = &args[1];

    println!("reading file: {}", filename);

    // ファイルを読み込む
    let file = std::fs::read_to_string(filename).expect("ファイルが読み込めませんでした");

    // ファイルの内容を表示
    println!("{}", file);

    // ファイルの内容を書き換え
    // 二つ目の引数の文字列を二つ目の文字列に書き換える
    let replaced = file.replace(&args[2], &args[3]);

    // 書き換えた内容を表示
    println!("{}", replaced);

    println!("random replace start");

    let start = std::env::args().nth(4).unwrap().parse::<u64>().unwrap();
    let end = std::env::args().nth(5).unwrap().parse::<u64>().unwrap();

    // 新しいfileを作る
    let new_file = format!("{}-{}~{}.txt", filename, start, end);
    std::fs::write(&new_file, "$$$$$$$$$").expect("ファイルが書き込めませんでした");

    let loop_n = std::env::args().nth(6).unwrap_or("100".to_string()).parse::<u64>().unwrap();

    // loop {
    for _ in 0..loop_n {
        // ファイルを読み込む
        let file = std::fs::read_to_string(filename).expect("ファイルが読み込めませんでした");

        // ランダムな数値を生成
        let random = rand::random::<u64>() % (end - start) + start;

        // 生成した数値をｋファイルの内容に書き換える
        let replaced = format!("{}, {}", file, random);

        // 書き換えた内容を表示
        println!("{}", replaced);

        // ファイルを書き換える
        std::fs::write(filename, &replaced).expect("ファイルが書き込めませんでした");

        // 1秒待つ
        // std::thread::sleep(std::time::Duration::from_secs(1));
    }
}
