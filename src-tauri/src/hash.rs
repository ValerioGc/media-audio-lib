//! Small stable hash shared by the library and the cover cache.

/// FNV-1a over the input, hex encoded. Deterministic across releases, unlike
/// `DefaultHasher`, so it is safe to persist.
pub fn fnv1a_hex(input: &str) -> String {
    const OFFSET_BASIS: u64 = 0xcbf2_9ce4_8422_2325;
    const PRIME: u64 = 0x0000_0100_0000_01b3;

    let mut hash = OFFSET_BASIS;
    for byte in input.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(PRIME);
    }

    format!("{hash:016x}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn e_stabile_per_lo_stesso_input() {
        assert_eq!(fnv1a_hex("brano.mp3"), fnv1a_hex("brano.mp3"));
    }

    #[test]
    fn distingue_input_diversi() {
        assert_ne!(fnv1a_hex("uno"), fnv1a_hex("due"));
    }

    #[test]
    fn produce_sempre_sedici_caratteri() {
        assert_eq!(fnv1a_hex("").len(), 16);
        assert_eq!(
            fnv1a_hex("percorso/molto/lungo/verso/un/brano.flac").len(),
            16
        );
    }
}
