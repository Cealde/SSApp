def are_anagrams(s1, s2):
    s1 = s1.replace(" ", "").lower()
    s2 = s2.replace(" ", "").lower()
    
    return sorted(s1) == sorted(s2)

print(are_anagrams("listen", "silent"))
print(are_anagrams("hello", "world"))