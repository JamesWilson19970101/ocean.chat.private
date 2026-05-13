/**
 * Lua script for atomically generating a strictly monotonic sequence ID.
 * It strictly avoids converting large numbers to Lua numbers to prevent 64-bit precision loss.
 * String length and lexicographical comparisons are used instead.
 */
export const GENERATE_SEQ_LUA = `
local key = KEYS[1]

local max_str = redis.call('HGET', key, 'max')
if not max_str then
    return nil
end

local cur_str = redis.call('HGET', key, 'cur')
if not cur_str then
    return nil
end

-- Helper function to safely compare two numeric strings representing positive integers
local function is_greater_or_equal(a, b)
    if #a ~= #b then 
        return #a > #b 
    end
    return a >= b
end

-- If current sequence is greater than or equal to the max allocated limit, return nil to trigger slow path
if is_greater_or_equal(cur_str, max_str) then
    return nil
end

-- Increment safely. HINCRBY works with 64-bit signed integers in Redis C core.
redis.call('HINCRBY', key, 'cur', 1)

-- Retrieve the new value as a string to guarantee absolutely zero precision loss
return redis.call('HGET', key, 'cur')
`;

/**
 * Lua script for atomically syncing a newly allocated segment into Redis.
 * It strictly prevents a delayed pod (whose lock expired) from overwriting a newer segment.
 */
export const SYNC_SEGMENT_LUA = `
local key = KEYS[1]
local new_max = ARGV[1]
local new_cur = ARGV[2]

local current_max = redis.call('HGET', key, 'max')

-- Helper function to safely compare two numeric strings representing positive integers
local function is_greater(a, b)
    if not b then return true end
    if #a ~= #b then 
        return #a > #b 
    end
    return a > b
end

if is_greater(new_max, current_max) then
    redis.call('HSET', key, 'max', new_max, 'cur', new_cur)
    return 1
else
    return 0
end
`;
