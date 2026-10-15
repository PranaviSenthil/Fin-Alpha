import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Tuple
from app.ai.schemas import OrchestratedAnalysis, AgentResponse
from app.ai.market_agent import market_analysis_agent
from app.ai.financial_agent import financial_research_agent
from app.ai.portfolio_agent import portfolio_analysis_agent
from app.ai.behavior_agent import trading_behavior_agent
from app.ai.observability import observability_tracker
from app.core.utils import sanitize_for_json

class CentralAIOrchestrator:
    """
    Central AI Orchestration Layer for VibeFinance.
    Coordinates specialized agents, executes concurrent analyses where independent,
    synthesizes multi-factor intelligence, and preserves conflicting findings across
    technicals, fundamentals, portfolio risks, and execution discipline.
    """

    def orchestrate(
        self,
        query: str = "comprehensive_audit",
        symbol: Optional[str] = None,
        user_id: Optional[str] = None,
        requested_agents: Optional[List[str]] = None
    ) -> OrchestratedAnalysis:
        now_iso = datetime.now(timezone.utc).isoformat()
        symbol = symbol.upper() if symbol else None
        
        # Determine which agents to execute
        # Valid agent keys: 'market', 'financial', 'portfolio', 'behavior'
        if not requested_agents:
            if symbol and user_id:
                requested_agents = ["market", "financial", "portfolio", "behavior"]
            elif symbol:
                requested_agents = ["market", "financial"]
            elif user_id:
                requested_agents = ["market", "portfolio", "behavior"]
            else:
                requested_agents = ["market"]

        agent_results: Dict[str, AgentResponse] = {}
        agents_involved: List[str] = []
        agent_latencies: Dict[str, float] = {}
        t_orch_start = time.perf_counter()

        def run_timed_agent(fn, *args):
            t0 = time.perf_counter()
            res = fn(*args)
            elapsed = round((time.perf_counter() - t0) * 1000, 1)
            return res, elapsed

        # Execute selected agents concurrently
        with ThreadPoolExecutor(max_workers=4) as executor:
            future_to_agent = {}

            if "market" in requested_agents:
                future_to_agent[executor.submit(run_timed_agent, market_analysis_agent.analyze, symbol)] = "market"
            if "financial" in requested_agents and symbol:
                future_to_agent[executor.submit(run_timed_agent, financial_research_agent.analyze, symbol, query)] = "financial"
            if "portfolio" in requested_agents and user_id:
                future_to_agent[executor.submit(run_timed_agent, portfolio_analysis_agent.analyze, user_id)] = "portfolio"
            if "behavior" in requested_agents and user_id:
                future_to_agent[executor.submit(run_timed_agent, trading_behavior_agent.analyze, user_id)] = "behavior"

            for future in as_completed(future_to_agent):
                agent_key = future_to_agent[future]
                try:
                    res, elapsed_ms = future.result()
                    agent_results[agent_key] = res
                    agents_involved.append(res.agent_name)
                    agent_latencies[agent_key] = elapsed_ms
                    observability_tracker.record_latency(agent_key, elapsed_ms)
                except Exception as e:
                    # Provide structured fallback error response rather than crashing the orchestrator
                    agent_results[agent_key] = AgentResponse(
                        agent_name=f"{agent_key.title()} Agent",
                        entity=symbol or "UNKNOWN",
                        summary=f"Analysis encountered an execution limitation: {str(e)}",
                        signal="Execution Error",
                        key_findings=[f"Failed to complete {agent_key} diagnostics."],
                        data_freshness="unavailable",
                        missing_data=[f"{agent_key} analysis results"],
                        warnings=[str(e)]
                    )

        total_orch_ms = round((time.perf_counter() - t_orch_start) * 1000, 1)
        observability_tracker.record_latency("orchestrator", total_orch_ms)

        # Cross-Agent Synthesis & Conflict Detection
        conflicts = self._detect_conflicts(agent_results, symbol)
        key_risks = self._aggregate_risks(agent_results)
        exec_summary, overall_sentiment = self._synthesize_executive_summary(
            agent_results, symbol, conflicts
        )

        # Collect aggregated citations across all active agents
        aggregated_citations = []
        for a_res in agent_results.values():
            agent_cits = getattr(a_res, "citations", None) or a_res.sources or []
            aggregated_citations.extend(agent_cits)

        # Compute portfolio risk concentration if portfolio agent ran
        holdings = []
        if "portfolio" in agent_results:
            holdings = agent_results["portfolio"].supporting_data.get("holdings", [])
        portfolio_risk = observability_tracker.compute_portfolio_concentration(holdings)

        execution_metrics = {
            "total_latency_ms": total_orch_ms,
            "agent_latencies_ms": agent_latencies,
            "portfolio_risk_concentration": portfolio_risk,
            "concurrency_mode": "ThreadPoolExecutor(max_workers=4)"
        }

        return OrchestratedAnalysis(
            query=query,
            target_symbol=symbol,
            executive_summary=exec_summary,
            overall_sentiment=overall_sentiment,
            agents_involved=agents_involved,
            agent_results=agent_results,
            cross_agent_conflicts=conflicts,
            key_risks=key_risks,
            all_citations=aggregated_citations,
            execution_metrics=execution_metrics,
            timestamp=now_iso,
            disclaimer="Multi-agent financial intelligence synthesized from verified quantitative feeds and paper-trading records. Not SEBI-registered advice."
        )

    def _detect_conflicts(self, results: Dict[str, AgentResponse], symbol: Optional[str]) -> List[str]:
        """
        Preserve explicit disagreements between independent agent assessments.
        For instance, positive technical momentum should not silence stretched valuation.
        """
        conflicts = []
        market = results.get("market")
        financial = results.get("financial")
        portfolio = results.get("portfolio")
        behavior = results.get("behavior")

        # 1. Technical Momentum vs. Fundamental Valuation
        if market and financial:
            m_sig = (market.signal or "").lower()
            f_sig = (financial.signal or "").lower()

            if "bullish" in m_sig and ("stretched" in f_sig or "debt" in f_sig):
                conflicts.append(
                    f"Momentum vs. Valuation Discrepancy: Market Analysis Agent indicates '{market.signal}' technical setup, "
                    f"whereas Financial Research Agent flags '{financial.signal}' with elevated valuation multiples or leverage."
                )
            elif "bearish" in m_sig and ("strong" in f_sig or "undervalued" in f_sig):
                conflicts.append(
                    f"Trend vs. Value Opportunity: Market Analysis Agent registers a '{market.signal}' trend, "
                    f"while Financial Research Agent highlights '{financial.signal}' with attractive historical multiples."
                )

        # 2. Portfolio Exposure vs. Bearish Signal
        if portfolio and symbol:
            holdings = portfolio.supporting_data.get("holdings", [])
            matching = next((h for h in holdings if h.get("symbol") == symbol), None)
            if matching and matching.get("portfolio_weight_pct", 0) > 15:
                if market and "bearish" in (market.signal or "").lower():
                    conflicts.append(
                        f"Concentration vs. Technical Posture: User holds {matching['portfolio_weight_pct']}% of portfolio "
                        f"in {symbol}, which is currently exhibiting a '{market.signal}' technical profile."
                    )
                if financial and ("stretched" in (financial.signal or "").lower() or "debt" in (financial.signal or "").lower()):
                    conflicts.append(
                        f"Portfolio Imbalance: Substantial capital ({matching['portfolio_weight_pct']}%) is committed to {symbol} "
                        f"despite Financial Research Agent warning of '{financial.signal}'."
                    )

        # 3. Behavior vs. Stated Strategy
        if behavior:
            b_data = behavior.supporting_data
            if b_data.get("risk_alignment") and "Misaligned" in b_data.get("risk_alignment", ""):
                conflicts.append(
                    f"Strategy Inconsistency: Trading Behavior Analysis Agent identified that observed order sizing "
                    f"conflicts with the user's declared risk profile ({b_data.get('stated_risk_profile')})."
                )

        # 4. Documentary Filing Divergences (RAG Evidence)
        if financial and getattr(financial, "conflicting_evidence", None):
            for ce in financial.conflicting_evidence:
                conflicts.append(
                    f"Filing Disclosure Divergence: {ce.get('explanation', 'Disparate commentary noted across verified corporate disclosures.')}"
                )

        # 5. Technical Momentum vs. Headline Sentiment Divergence (PS 04 Task 2)
        if market:
            sent_data = getattr(market, "news_sentiment", None) or market.supporting_data.get("news_sentiment")
            if sent_data and isinstance(sent_data, dict):
                s_class = sent_data.get("classification")
                s_score = sent_data.get("overall_score")
                s_count = sent_data.get("headlines_analyzed", 0)
                m_sig = (market.signal or "").lower()

                if "bullish" in m_sig and s_class == "Negative":
                    score_txt = f"{s_score:+.2f}" if s_score is not None else "Negative"
                    conflicts.append(
                        f"Technical Momentum vs. News Sentiment Conflict: Market Analysis Agent registers '{market.signal}' "
                        f"technical momentum, whereas financial news headline sentiment is '{s_class}' (Score: {score_txt}) "
                        f"across {s_count} analyzed headlines."
                    )
                elif "bearish" in m_sig and s_class == "Positive":
                    score_txt = f"{s_score:+.2f}" if s_score is not None else "Positive"
                    conflicts.append(
                        f"Technical Trend vs. News Sentiment Conflict: Market Analysis Agent registers '{market.signal}' "
                        f"technical trajectory, while financial news headline sentiment reflects '{s_class}' (Score: {score_txt}) "
                        f"with favorable news coverage."
                    )

        return conflicts

    def _aggregate_risks(self, results: Dict[str, AgentResponse]) -> List[str]:
        risks = []
        for agent_key, res in results.items():
            for r in res.risks_and_limitations:
                if r not in risks:
                    risks.append(f"[{res.agent_name}] {r}")
            for w in res.warnings:
                warning_entry = f"[{res.agent_name} Warning] {w}"
                if warning_entry not in risks:
                    risks.append(warning_entry)
        return risks[:8]

    def _synthesize_executive_summary(
        self,
        results: Dict[str, AgentResponse],
        symbol: Optional[str],
        conflicts: List[str]
    ) -> Tuple[str, str]:
        parts = []
        market = results.get("market")
        financial = results.get("financial")
        portfolio = results.get("portfolio")
        behavior = results.get("behavior")

        overall_sentiment = "Neutral / Multi-Factor"

        if market:
            parts.append(f"Market Analysis evaluates posture as '{market.signal}'.")
            m_sent = getattr(market, "news_sentiment", None) or market.supporting_data.get("news_sentiment")
            if m_sent and isinstance(m_sent, dict) and m_sent.get("classification") not in ("Unavailable", None):
                parts.append(f"Financial news flow registers as '{m_sent.get('classification')}' ({m_sent.get('headlines_analyzed', 0)} headlines).")
        if financial:
            parts.append(f"Financial Research classifies corporate fundamentals as '{financial.signal}'.")
        if portfolio:
            parts.append(f"Portfolio Analysis assesses position distribution as '{portfolio.signal}'.")
        if behavior:
            parts.append(f"Trading Behavior Analysis characterizes execution discipline as '{behavior.signal}'.")

        if conflicts:
            parts.append(f"Note: {len(conflicts)} cross-factor divergence(s) were isolated between agent perspectives.")

        # Determine overall sentiment
        if market and financial:
            if "bullish" in (market.signal or "").lower() and "strong" in (financial.signal or "").lower():
                overall_sentiment = "Strong Bullish Convergence"
            elif "bearish" in (market.signal or "").lower() and ("stretched" in (financial.signal or "").lower() or "debt" in (financial.signal or "").lower()):
                overall_sentiment = "Bearish Multi-Factor Consensus"
            elif conflicts:
                overall_sentiment = "Divergent / Conflicted Signals"
            else:
                overall_sentiment = "Balanced Stance"
        elif market:
            overall_sentiment = market.signal or "Neutral"

        exec_summary = " ".join(parts) if parts else "Multi-agent synthesis complete."
        return exec_summary, overall_sentiment

central_ai_orchestrator = CentralAIOrchestrator()
