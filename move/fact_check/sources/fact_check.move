/// RemitGuard claim-check registry.
///
/// The backend calls `record_claim_check` after a claim (something a user
/// mentioned in a payment message, e.g. "hurricane in the Philippines") has
/// been cross-verified by two independent Gonka models against real retrieved
/// evidence (never from a model's own memory - see server/src/factcheck).
/// This event is the public, independently-auditable record that the verdict
/// was not produced or altered by a centralized server after the fact: anyone
/// can look up the transaction on a Sui explorer and see the verdict, the
/// evidence count, and who submitted it.
///
/// Only a hash of the claim text is stored, not the raw text, so the ledger
/// never becomes a public database of what people wrote in private messages.
/// Anyone holding the original claim text can still verify the hash matches.
module fact_check::fact_check {
    use sui::event;

    /// UNVERIFIABLE = 0 (no evidence could be retrieved for this claim)
    /// SUPPORTED    = 1 (retrieved evidence corroborates the claim)
    /// CONTRADICTED = 2 (retrieved evidence refutes the claim)
    /// DISPUTED     = 3 (evidence exists but the two models disagreed on it)
    public struct ClaimChecked has copy, drop {
        claim_hash: vector<u8>,
        verdict: u8,
        evidence_count: u64,
        checked_by: address,
    }

    public fun record_claim_check(
        claim_hash: vector<u8>,
        verdict: u8,
        evidence_count: u64,
        ctx: &TxContext,
    ) {
        event::emit(ClaimChecked {
            claim_hash,
            verdict,
            evidence_count,
            checked_by: tx_context::sender(ctx),
        });
    }
}
