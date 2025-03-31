function tS(num: number): string {
    const st = num.toString();
    return st.length > 1 ? st : `0${st}`;
}

export function normalizeTime(second: number): string {
    const hour = Math.floor(second / 3_600);
    const min = Math.floor((second % 3_600) / 60);
    const sec = Math.floor(second % 60);

    return `${hour > 0 ? `${tS(hour)}:` : ""}${tS(min)}:${tS(sec)}`;
}
