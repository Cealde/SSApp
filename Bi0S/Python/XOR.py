def find_pairs_with_xor(arr, target):
    seen = set()
    pairs = []
    for num in arr:
        c= num ^ target 
        if c in seen:
            pairs.append((c, num))
        seen.add(num)
    return pairs
arr = [5, 4, 10, 15, 7, 6]
target = 5
result = find_pairs_with_xor(arr, target)
print("Pairs with XOR =", target, "are:", result)