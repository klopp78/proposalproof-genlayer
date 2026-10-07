# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""Consensus receipts that bind governance proposals to their execution transactions."""

from genlayer import *
import hashlib
import json
import typing


class ProposalExecutionGuard(gl.Contract):
    """Append-only, evidence-bound governance execution assessments."""

    assessment_count: u64
    latest_assessment_id: str
    assessment_ids: DynArray[str]
    assessments: TreeMap[str, str]
    claimed_executions: TreeMap[str, str]

    def __init__(self):
        self.assessment_count = u64(0)
        self.latest_assessment_id = ""

    @gl.public.view
    def get_assessment_count(self) -> u64:
        return self.assessment_count

    @gl.public.view
    def get_latest_assessment_id(self) -> str:
        return self.latest_assessment_id

    @gl.public.view
    def get_assessment(self, assessment_id: str) -> str:
        return self.assessments.get(assessment_id, "")

    @gl.public.view
    def list_assessment_ids(self) -> str:
        return json.dumps([item for item in self.assessment_ids], separators=(",", ":"))

    @gl.public.view
    def get_execution_claim(self, execution_tx_url: str) -> str:
        return self.claimed_executions.get(_sha256(_https_url(execution_tx_url)), "")

    @gl.public.write
    def assess_execution(
        self,
        governance_name: str,
        proposal_id: str,
        proposal_url: str,
        execution_tx_url: str,
        declared_actions: str,
        source_urls: DynArray[str],
    ) -> str:
        governance = _short_text(governance_name, "governance_name", 2, 160)
        proposal = _short_text(proposal_id, "proposal_id", 1, 120)
        canonical_proposal_url = _https_url(proposal_url)
        canonical_execution_url = _https_url(execution_tx_url)
        actions = _long_text(declared_actions, "declared_actions", 10, 6000)
        urls = _validate_sources([item for item in source_urls])
        if canonical_proposal_url not in urls or canonical_execution_url not in urls:
            raise Exception("proposal_and_execution_urls_must_be_sources")

        manifest = _source_manifest(urls)
        if len({item["host"] for item in manifest}) < 2:
            raise Exception("at_least_two_independent_hosts_required")

        action_hash = _sha256(actions)
        execution_reference_hash = _sha256(canonical_execution_url)
        context_hash = _sha256_parts([
            "proposalexecutionguard.v1",
            governance,
            proposal,
            canonical_proposal_url,
            canonical_execution_url,
            action_hash,
            _canonical_json(manifest),
        ])

        def leader_fn():
            return _evaluate_execution(
                governance,
                proposal,
                canonical_proposal_url,
                canonical_execution_url,
                actions,
                urls,
                manifest,
                context_hash,
            )

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            try:
                proposed = _parse_result(leader_result.calldata)
                independent = _parse_result(_evaluate_execution(
                    governance,
                    proposal,
                    canonical_proposal_url,
                    canonical_execution_url,
                    actions,
                    urls,
                    manifest,
                    context_hash,
                ))
            except Exception:
                return False
            return (
                proposed["decision"] == independent["decision"]
                and proposed["proposal_status"] == independent["proposal_status"]
                and proposed["execution_status"] == independent["execution_status"]
                and proposed["proposal_match"] == independent["proposal_match"]
                and proposed["action_match"] == independent["action_match"]
                and proposed["execution_tx_match"] == independent["execution_tx_match"]
                and proposed["target_chain"] == independent["target_chain"]
                and proposed["executed_at_utc"] == independent["executed_at_utc"]
                and proposed["supporting_source_count"] == independent["supporting_source_count"]
                and proposed["readable_source_count"] == independent["readable_source_count"]
                and proposed["source_snapshot_hashes"] == independent["source_snapshot_hashes"]
                and proposed["snapshot_bundle_hash"] == independent["snapshot_bundle_hash"]
                and proposed["assessment_context_hash"] == independent["assessment_context_hash"]
                and abs(proposed["confidence"] - independent["confidence"]) <= 10
            )

        result = _parse_result(gl.vm.run_nondet_unsafe(leader_fn, validator_fn))
        if result["decision"] == "executed_match":
            existing = self.claimed_executions.get(execution_reference_hash, "")
            if existing != "":
                raise Exception("execution_already_claimed")

        self.assessment_count = u64(int(self.assessment_count) + 1)
        sequence = int(self.assessment_count)
        assessment_id = "peg_" + _sha256_parts([context_hash, str(sequence)])[:20]
        record = {
            "schema_version": "proposalexecutionguard.v1",
            "assessment_id": assessment_id,
            "sequence": sequence,
            "governance_name": governance,
            "proposal_id": proposal,
            "proposal_url": canonical_proposal_url,
            "execution_tx_url": canonical_execution_url,
            "declared_actions": actions,
            "declared_actions_hash": action_hash,
            "execution_reference_hash": execution_reference_hash,
            "assessment_context_hash": context_hash,
            "source_manifest": manifest,
            "source_snapshot_hashes": result["source_snapshot_hashes"],
            "snapshot_bundle_hash": result["snapshot_bundle_hash"],
            "submitted_by": str(gl.message.sender_address).lower(),
            "decision": result["decision"],
            "proposal_status": result["proposal_status"],
            "execution_status": result["execution_status"],
            "confidence": result["confidence"],
            "proposal_match": result["proposal_match"],
            "action_match": result["action_match"],
            "execution_tx_match": result["execution_tx_match"],
            "target_chain": result["target_chain"],
            "executed_at_utc": result["executed_at_utc"],
            "supporting_source_count": result["supporting_source_count"],
            "readable_source_count": result["readable_source_count"],
        }
        record_hash = _sha256(_canonical_json(record))
        record["accepted_write"] = {
            "assessment_id": assessment_id,
            "record_hash": record_hash,
            "snapshot_bundle_hash": result["snapshot_bundle_hash"],
            "execution_reference_hash": execution_reference_hash,
        }
        self.assessments[assessment_id] = _canonical_json(record)
        self.assessment_ids.append(assessment_id)
        self.latest_assessment_id = assessment_id
        if result["decision"] == "executed_match":
            self.claimed_executions[execution_reference_hash] = assessment_id
        return assessment_id


def _evaluate_execution(
    governance: str,
    proposal: str,
    proposal_url: str,
    execution_url: str,
    actions: str,
    urls: typing.Sequence[str],
    manifest: typing.Sequence[dict],
    context_hash: str,
) -> str:
    snapshots = []
    snapshot_hashes = []
    readable_count = 0
    for index, url in enumerate(urls):
        try:
            rendered = gl.nondet.web.render(url, mode="text")[:10000]
            readable = len(rendered.strip()) >= 40
        except Exception:
            rendered = "SOURCE_UNAVAILABLE"
            readable = False
        if readable:
            readable_count += 1
        snapshot_hash = _sha256(rendered)
        snapshot_hashes.append(snapshot_hash)
        snapshots.append({
            "source_index": index + 1,
            "host": manifest[index]["host"],
            "readable": readable,
            "snapshot_hash": snapshot_hash,
            "text": rendered,
        })

    bundle_hash = _sha256_parts([context_hash, _canonical_json(snapshot_hashes)])
    if readable_count < 2:
        return _canonical_json(_result_payload(
            "insufficient_evidence", "unknown", "unknown", 100,
            False, False, False, "unknown", "", 0, readable_count,
            snapshot_hashes, bundle_hash, context_hash,
        ))

    prompt = f"""
You adjudicate whether a public governance proposal was executed exactly as approved. Review the
independently rendered proposal, governance, and block-explorer evidence. Match the exact
governance body and proposal ID. Compare the declared action list with the targets, calls, values,
and parameters reported for the execution transaction. Do not infer execution merely because a
proposal passed. Use mismatch for a confirmed transaction that changes, omits, or adds a
consequential action. Use disputed when sources conflict or the relationship cannot be proven.

Governance: {governance}
Proposal ID: {proposal}
Canonical proposal URL: {proposal_url}
Canonical execution transaction URL: {execution_url}
Declared approved actions: {actions}
Source manifest: {_canonical_json(manifest)}
Rendered evidence: {_canonical_json(snapshots)}

Return only minified JSON with exactly these fields: decision
(executed_match|passed_not_executed|mismatch|rejected_or_cancelled|disputed), proposal_status
(passed|rejected|cancelled|active|unknown), execution_status (success|failed|not_found|unknown),
confidence (0-100), proposal_match (boolean), action_match (boolean), execution_tx_match (boolean),
target_chain (ethereum|base|arbitrum|optimism|polygon|bsc|solana|other|unknown), executed_at_utc
(empty or ISO-8601 UTC), and supporting_source_count (integer). No prose or extra fields.
"""
    model_result = json.loads(gl.nondet.exec_prompt(prompt))
    parsed = _parse_model_fields(model_result)
    parsed.update({
        "readable_source_count": readable_count,
        "source_snapshot_hashes": snapshot_hashes,
        "snapshot_bundle_hash": bundle_hash,
        "assessment_context_hash": context_hash,
    })
    return _canonical_json(parsed)


def _result_payload(
    decision: str,
    proposal_status: str,
    execution_status: str,
    confidence: int,
    proposal_match: bool,
    action_match: bool,
    execution_tx_match: bool,
    target_chain: str,
    executed_at: str,
    supporting_count: int,
    readable_count: int,
    hashes: typing.Sequence[str],
    bundle_hash: str,
    context_hash: str,
) -> dict:
    return {
        "decision": decision,
        "proposal_status": proposal_status,
        "execution_status": execution_status,
        "confidence": confidence,
        "proposal_match": proposal_match,
        "action_match": action_match,
        "execution_tx_match": execution_tx_match,
        "target_chain": target_chain,
        "executed_at_utc": executed_at,
        "supporting_source_count": supporting_count,
        "readable_source_count": readable_count,
        "source_snapshot_hashes": hashes,
        "snapshot_bundle_hash": bundle_hash,
        "assessment_context_hash": context_hash,
    }


def _parse_model_fields(raw: dict) -> dict:
    decision = str(raw.get("decision", "")).lower()
    proposal_status = str(raw.get("proposal_status", "")).lower()
    execution_status = str(raw.get("execution_status", "")).lower()
    target_chain = str(raw.get("target_chain", "")).lower()
    if decision not in (
        "executed_match", "passed_not_executed", "mismatch",
        "rejected_or_cancelled", "disputed", "insufficient_evidence",
    ):
        raise Exception("invalid_decision")
    if proposal_status not in ("passed", "rejected", "cancelled", "active", "unknown"):
        raise Exception("invalid_proposal_status")
    if execution_status not in ("success", "failed", "not_found", "unknown"):
        raise Exception("invalid_execution_status")
    if target_chain not in (
        "ethereum", "base", "arbitrum", "optimism", "polygon", "bsc", "solana", "other", "unknown",
    ):
        raise Exception("invalid_target_chain")
    confidence = int(raw.get("confidence", -1))
    if confidence < 0 or confidence > 100:
        raise Exception("invalid_confidence")
    flags = ("proposal_match", "action_match", "execution_tx_match")
    if any(not isinstance(raw.get(field), bool) for field in flags):
        raise Exception("invalid_match_flags")
    executed_at = _optional_timestamp(raw.get("executed_at_utc", ""))
    supporting_count = int(raw.get("supporting_source_count", -1))
    if supporting_count < 0 or supporting_count > 5:
        raise Exception("invalid_supporting_source_count")
    if decision == "executed_match" and (
        proposal_status != "passed"
        or execution_status != "success"
        or not raw["proposal_match"]
        or not raw["action_match"]
        or not raw["execution_tx_match"]
        or supporting_count < 2
        or executed_at == ""
    ):
        raise Exception("executed_match_requires_complete_proof")
    if decision == "passed_not_executed" and proposal_status != "passed":
        raise Exception("invalid_passed_not_executed")
    return {
        "decision": decision,
        "proposal_status": proposal_status,
        "execution_status": execution_status,
        "confidence": confidence,
        "proposal_match": raw["proposal_match"],
        "action_match": raw["action_match"],
        "execution_tx_match": raw["execution_tx_match"],
        "target_chain": target_chain,
        "executed_at_utc": executed_at,
        "supporting_source_count": supporting_count,
    }


def _parse_result(raw: str) -> dict:
    result = json.loads(raw)
    parsed = _parse_model_fields(result)
    hashes = result.get("source_snapshot_hashes", [])
    if not isinstance(hashes, list) or len(hashes) < 2 or len(hashes) > 5:
        raise Exception("invalid_snapshot_hashes")
    if any(not _is_digest(str(item)) for item in hashes):
        raise Exception("invalid_snapshot_hash")
    readable_count = int(result.get("readable_source_count", -1))
    if readable_count < 0 or readable_count > len(hashes):
        raise Exception("invalid_readable_source_count")
    if parsed["supporting_source_count"] > readable_count:
        raise Exception("supporting_count_exceeds_readable_sources")
    bundle_hash = str(result.get("snapshot_bundle_hash", ""))
    context_hash = str(result.get("assessment_context_hash", ""))
    if not _is_digest(bundle_hash) or not _is_digest(context_hash):
        raise Exception("invalid_commitment")
    parsed.update({
        "readable_source_count": readable_count,
        "source_snapshot_hashes": [str(item) for item in hashes],
        "snapshot_bundle_hash": bundle_hash,
        "assessment_context_hash": context_hash,
    })
    return parsed


def _validate_sources(raw_urls: typing.Sequence[str]) -> typing.Sequence[str]:
    if len(raw_urls) < 2 or len(raw_urls) > 5:
        raise Exception("use_two_to_five_sources")
    urls = []
    seen = set()
    for raw in raw_urls:
        url = _https_url(raw)
        key = url.rstrip("/").lower()
        if key in seen:
            raise Exception("duplicate_source_url")
        seen.add(key)
        urls.append(url)
    return urls


def _source_manifest(urls: typing.Sequence[str]) -> typing.Sequence[dict]:
    return [{
        "source_index": index + 1,
        "url": url,
        "host": _host(url),
        "url_hash": _sha256(url),
    } for index, url in enumerate(urls)]


def _host(url: str) -> str:
    host = url.split("//", 1)[1].split("/", 1)[0].split(":", 1)[0].lower()
    if "." not in host or len(host) > 253:
        raise Exception("invalid_source_host")
    return host


def _https_url(raw: str) -> str:
    value = str(raw).strip()
    if not value.startswith("https://") or len(value) > 600:
        raise Exception("invalid_https_url")
    _host(value)
    return value


def _short_text(raw: str, field: str, minimum: int, maximum: int) -> str:
    value = str(raw).strip()
    if len(value) < minimum or len(value) > maximum or any(char in value for char in "\n\r\t"):
        raise Exception("invalid_" + field)
    return value


def _long_text(raw: str, field: str, minimum: int, maximum: int) -> str:
    value = str(raw).strip()
    if len(value) < minimum or len(value) > maximum or "\x00" in value:
        raise Exception("invalid_" + field)
    return value


def _optional_timestamp(raw) -> str:
    value = str(raw).strip()
    if value == "":
        return ""
    if len(value) < 20 or len(value) > 35 or "T" not in value or not value.endswith("Z"):
        raise Exception("use_iso_8601_utc")
    return value


def _canonical_json(value) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def _canonical_parts(parts: typing.Sequence[str]) -> str:
    return "".join(str(len(str(part))) + ":" + str(part) for part in parts)


def _sha256_parts(parts: typing.Sequence[str]) -> str:
    return _sha256(_canonical_parts(parts))


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _is_digest(value: str) -> bool:
    return len(value) == 64 and all(char in "0123456789abcdef" for char in value)
