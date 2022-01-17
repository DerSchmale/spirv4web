// high is the first parameter because this reads nicer
function bigintFrom(high: number, low: number): bigint
{
    const low_ = BigInt(low);
    const high_ = BigInt(high);

    return low_ | (high_ << BigInt(32));
}