export function replaceCharAt(str: string, index: number, char: string): string
{
    return str.substring(0, index) + char + str.substring(index + 1);
}