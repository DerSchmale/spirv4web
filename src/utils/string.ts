export function replaceCharAt(str: string, index: number, char: string): string
{
    return str.substring(0, index) + char + str.substring(index + 1);
}

export function convert_to_string(value: any);
export function convert_to_string(value: bigint, int64_type: string, long_long_literal_suffix: boolean);
export function convert_to_string(value: any, int64_type?: string, long_long_literal_suffix?: boolean)
{
    // ignore radix char as JS always uses .
    if (int64_type === undefined)
        return value.toString();

    return value.toString() + (long_long_literal_suffix ? "ll" : "l");
}