// Standing test convention (Jason, 2026-08-08): prefixes are not always
// "2." - exercise other logical separators too. The dot is the friendly
// case; dashes, tildes, equals, underscores, and especially regex-special
// characters (*, +, $) stress the escaping and string-matching paths that
// "2." never touches. Shared by the deterministic prefix suite AND the
// property generators (review D3, 2026-09-09: the properties used only
// "2." and "P-", the one separator the convention singles out as not
// enough).
export const PREFIXES = ["2.", "2-", "2~", "3=", "4_", "ch2*", "n5+", "a$"];
