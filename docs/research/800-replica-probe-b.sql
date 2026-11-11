/* ============================================================================================
   NOTE: B4/B4b filter RetailTrxCondition on [Year]/[Month]; those columns are always 0 on the replica, so both return nothing. Probe C (d1) redoes them through RetailTrx.
   793 / ticket 800 — stage B: volumes, keys and the cost of a daily aggregate.  READ-ONLY.
   Target : 172.23.27.47 / POS (DWPOSREPL03), the `read` login. Aggregates only; no #temp.
   Anchor : yesterday (@d0 .. @d1). Every section prints its own elapsed ms.
   ============================================================================================ */
SET NOCOUNT ON; SET ANSI_WARNINGS OFF;
DECLARE @d1 DATETIME = CAST(CAST(GETDATE() AS DATE) AS DATETIME);
DECLARE @d0 DATETIME = DATEADD(DAY, -1, @d1), @d30 DATETIME = DATEADD(DAY, -30, @d1);
DECLARE @t DATETIME2;

/* B0 — key columns of every rowstore index on the new tables */
SELECT  TableName = OBJECT_NAME(ic.object_id), IndexName = i.name, ic.key_ordinal, ColumnName = c.name
FROM    sys.index_columns ic
JOIN    sys.indexes i ON i.object_id = ic.object_id AND i.index_id = ic.index_id
JOIN    sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE   OBJECT_NAME(ic.object_id) IN ('NAuth','NAuthLine','LoyActivityStatisticsDay','LoyActivityTypeStatisticsDay',
                                      'LoyLedger','Bonusbuy','BBHeader','NPaymentNotice','NPaymentReconciliation')
  AND   i.type NOT IN (5,6) AND ic.is_included_column = 0
ORDER BY TableName, IndexName, ic.key_ordinal;
SELECT  TableName = t.name, [Rows] = SUM(p.rows), Cols = STUFF((SELECT ',' + c.name FROM sys.columns c WHERE c.object_id = t.object_id ORDER BY c.column_id FOR XML PATH('')), 1, 1, '')
FROM    sys.tables t JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
WHERE   t.name IN ('NAuth','NPaymentNotice','NPaymentReconciliation') GROUP BY t.name, t.object_id;

/* B1 — loyalty: one day of LoyActivity by group (rowstore, PK ActivityId: a full scan) */
SET @t = SYSDATETIME();
SELECT  a.ActivityTypeGroup, a.TransactionType, Activities = COUNT(*), Cancellations = SUM(CAST(a.IsCancellation AS INT)),
        SalesAmount = SUM(a.SalesAmount), SpendPoints = SUM(a.SpendPoints), PointsInCurrency = SUM(a.PointsAmountInCurrency),
        Branches = COUNT(DISTINCT a.BranchId), WithCampaign = SUM(CASE WHEN ISNULL(a.CampaignId,'') <> '' THEN 1 ELSE 0 END),
        WithOrderNo = SUM(CASE WHEN ISNULL(a.OrderNumber,'') <> '' THEN 1 ELSE 0 END)
FROM    LoyActivity a WHERE a.ActivityDateTime >= @d0 AND a.ActivityDateTime < @d1
GROUP BY a.ActivityTypeGroup, a.TransactionType ORDER BY Activities DESC;
SELECT  Section = 'B1 LoyActivity one day', ElapsedMs = DATEDIFF(MILLISECOND, @t, SYSDATETIME());

/* B1b — does BranchId join Store? does ActivityId order by time (a range-seek proxy)? */
SET @t = SYSDATETIME();
SELECT  Rows_ = COUNT(*), BranchMatchesStore = SUM(CASE WHEN s.StoreCode IS NOT NULL THEN 1 ELSE 0 END),
        MinActivityId = MIN(a.ActivityId), MaxActivityId = MAX(a.ActivityId), NewestEntry = MAX(a.EntryTime)
FROM    LoyActivity a LEFT JOIN Store s ON s.StoreCode = a.BranchId
WHERE   a.ActivityDateTime >= @d0 AND a.ActivityDateTime < @d1;
SELECT  Section = 'B1b branch join', ElapsedMs = DATEDIFF(MILLISECOND, @t, SYSDATETIME());

/* B2 — loyalty snapshots: balance and tier, enrolments yesterday */
SET @t = SYSDATETIME();
SELECT  TierId, Members = COUNT(*), PointsBalance = SUM(PointsBalance), Pending = SUM(PendingPoints) FROM LoyMembership GROUP BY TierId;
SELECT  Section = 'B2 LoyMembership snapshot', ElapsedMs = DATEDIFF(MILLISECOND, @t, SYSDATETIME());
SET @t = SYSDATETIME();
SELECT  MemberType, Enrolments = COUNT(*), Branches = COUNT(DISTINCT CreatedByBranchId)
FROM    LoyMember WHERE CreatedAt >= @d0 AND CreatedAt < @d1 GROUP BY MemberType;
SELECT  Section = 'B2b LoyMember enrolments', ElapsedMs = DATEDIFF(MILLISECOND, @t, SYSDATETIME());

/* B3 — the loyalty-redemption payment on the till: which PayTypeID, and does it key to LoyActivity? */
SET @t = SYSDATETIME();
SELECT  TOP 15 p.PayTypeID, Payments = COUNT(*), Amount = SUM(p.Amount),
        WithLoyaltyId = SUM(CASE WHEN ISNULL(p.LoyaltyCustomerID,'') <> '' THEN 1 ELSE 0 END),
        WithRequestId = SUM(CASE WHEN ISNULL(p.RequestId,'') <> '' THEN 1 ELSE 0 END),
        WithReference = SUM(CASE WHEN ISNULL(p.ReferenceNumber,'') <> '' THEN 1 ELSE 0 END)
FROM    RetailTrxPayment p WHERE p.TrxDate >= @d0 AND p.TrxDate < @d1
GROUP BY p.PayTypeID ORDER BY Payments DESC;
SELECT  Section = 'B3 payment types', ElapsedMs = DATEDIFF(MILLISECOND, @t, SYSDATETIME());

SET @t = SYSDATETIME();
SELECT  x.ActivityType, Redemptions = COUNT(*), PointsInCurrency = SUM(x.PointsAmountInCurrency),
        MatchByRequestId = SUM(x.mReq), MatchByReference = SUM(x.mRef), MatchTrxByReference = SUM(x.mTrx)
FROM   (SELECT r.ActivityType, r.PointsAmountInCurrency,
               mReq = CASE WHEN r.RequestId <> '' AND EXISTS (SELECT 1 FROM RetailTrxPayment p WHERE p.TrxDate >= @d0 AND p.TrxDate < @d1 AND p.RequestId = r.RequestId) THEN 1 ELSE 0 END,
               mRef = CASE WHEN r.ReferenceNumber <> '' AND EXISTS (SELECT 1 FROM RetailTrxPayment p WHERE p.TrxDate >= @d0 AND p.TrxDate < @d1 AND p.ReferenceNumber = r.ReferenceNumber) THEN 1 ELSE 0 END,
               mTrx = CASE WHEN EXISTS (SELECT 1 FROM RetailTrx t WHERE t.TrxDate >= @d0 AND t.TrxDate < @d1 AND t.TrxNumber = r.ReferenceNumber AND t.StoreCode = r.BranchId) THEN 1 ELSE 0 END
        FROM LoyActivity r
        WHERE r.ActivityDateTime >= @d0 AND r.ActivityDateTime < @d1 AND r.ActivityTypeGroup = 'R') x
GROUP BY x.ActivityType;
SELECT  Section = 'B3b redemption key match', ElapsedMs = DATEDIFF(MILLISECOND, @t, SYSDATETIME());

/* B4 — coupons and bonus buys from the till side (RetailTrxCondition has an NCCI) */
SET @t = SYSDATETIME();
SELECT  Kind = CASE WHEN c.WithCoupon = 1 OR c.CouponCode <> '' THEN 'coupon'
                    WHEN c.BbyNumber <> '' OR ISNULL(c.BBCode,'') <> '' THEN 'bonus buy'
                    WHEN c.PromoNumber <> '' OR c.PromoNo <> '' THEN 'promo' ELSE 'other' END,
        c.MainConditionType, Rows_ = COUNT(*), CondAmount = SUM(c.CondAmount), DiscountAmount = SUM(c.DiscountAmount),
        Trx = COUNT(DISTINCT c.StoreCode + '|' + c.MachineCode + '|' + c.TrxNumber),
        Coupons = COUNT(DISTINCT NULLIF(c.CouponCode,'')), Bbys = COUNT(DISTINCT NULLIF(c.BbyNumber,'')),
        InfoOnly = SUM(CAST(c.IsInfoOnly AS INT)), Disabled = SUM(CAST(c.IsDisabled AS INT))
FROM    RetailTrxCondition c
JOIN    RetailTrx t ON t.Client = c.Client AND t.StoreCode = c.StoreCode AND t.MachineCode = c.MachineCode AND t.TrxNumber = c.TrxNumber
WHERE   c.[Year] = YEAR(@d0) AND c.[Month] = MONTH(@d0) AND t.TrxDate >= @d0 AND t.TrxDate < @d1
GROUP BY CASE WHEN c.WithCoupon = 1 OR c.CouponCode <> '' THEN 'coupon'
              WHEN c.BbyNumber <> '' OR ISNULL(c.BBCode,'') <> '' THEN 'bonus buy'
              WHEN c.PromoNumber <> '' OR c.PromoNo <> '' THEN 'promo' ELSE 'other' END, c.MainConditionType
ORDER BY Rows_ DESC;
SELECT  Section = 'B4 RetailTrxCondition one day', ElapsedMs = DATEDIFF(MILLISECOND, @t, SYSDATETIME());

/* B4b — do condition bonus-buy numbers find a BBHeader / Bonusbuy row? */
SET @t = SYSDATETIME();
SELECT  Bbys = COUNT(*), InBBHeader = SUM(y.inH), InBonusbuy = SUM(y.inB)
FROM   (SELECT inH = CASE WHEN EXISTS (SELECT 1 FROM BBHeader h WHERE h.BBCode = x.BbyNumber) THEN 1 ELSE 0 END,
               inB = CASE WHEN EXISTS (SELECT 1 FROM Bonusbuy b WHERE b.Code = x.BbyNumber) THEN 1 ELSE 0 END
        FROM (SELECT DISTINCT c.BbyNumber FROM RetailTrxCondition c
              WHERE c.[Year] = YEAR(@d0) AND c.[Month] = MONTH(@d0) AND c.BbyNumber <> '') x) y;
SELECT  Section = 'B4b bby key match (month)', ElapsedMs = DATEDIFF(MILLISECOND, @t, SYSDATETIME());

/* B5 — RetailTrxDetailPromo for one day (rowstore, PK seek from RetailTrx) */
SET @t = SYSDATETIME();
SELECT  Lines = COUNT(*), TotalBBDiscount = SUM(d.TotalBBDiscount), TotalPromo = SUM(d.TotalPromoDiscountValue), PriceCut = SUM(d.PriceCut)
FROM    RetailTrx t
JOIN    RetailTrxDetailPromo d ON d.Client = t.Client AND d.StoreCode = t.StoreCode AND d.MachineCode = t.MachineCode AND d.TrxNumber = t.TrxNumber
WHERE   t.TrxDate >= @d0 AND t.TrxDate < @d1;
SELECT  Section = 'B5 RetailTrxDetailPromo one day', ElapsedMs = DATEDIFF(MILLISECOND, @t, SYSDATETIME());

/* B6 — order-side coupons and approval status (SdDocumentLine has no date: join the header) */
SET @t = SYSDATETIME();
SELECT  l.ApprovalStatus, Lines = COUNT(*), Orders = COUNT(DISTINCT l.DocumentNo),
        OrdersWithPayer = COUNT(DISTINCT CASE WHEN ISNULL(h.PayerCode,'') <> '' THEN l.DocumentNo END),
        CouponLines = SUM(CASE WHEN ISNULL(l.PromotionCouponCode,'') <> '' THEN 1 ELSE 0 END), CouponDiscount = SUM(l.PromotionCouponDiscount)
FROM    SdDocumentHeader h JOIN SdDocumentLine l ON l.DocumentNo = h.DocumentNo
WHERE   h.EntryTime >= @d30 AND h.EntryTime < @d1 AND h.DocumentCategory = 'C'
GROUP BY l.ApprovalStatus ORDER BY Lines DESC;
SELECT  Section = 'B6 order lines 30 days', ElapsedMs = DATEDIFF(MILLISECOND, @t, SYSDATETIME());

/* B7 — Nphies authorisations: volume, outcome, payer, freshness (30 days) */
SET @t = SYSDATETIME();
SELECT  a.ClaimType, a.StatusCode, a.Result, Auths = COUNT(*), Payers = COUNT(DISTINCT a.PayerCode),
        Newest = MAX(a.ActionDateTime)
FROM    NAuth a WHERE a.ActionDateTime >= @d30 AND a.ActionDateTime < @d1
GROUP BY a.ClaimType, a.StatusCode, a.Result ORDER BY Auths DESC;
SELECT  Section = 'B7 NAuth 30 days', ElapsedMs = DATEDIFF(MILLISECOND, @t, SYSDATETIME());
SET @t = SYSDATETIME();
SELECT  l.AdjudicationOutcome, Lines = COUNT(*), NetAmount = SUM(l.NetAmount), Benefit = SUM(l.Benefit), Submitted = SUM(l.Submitted)
FROM    NAuth a JOIN NAuthLine l ON l.Id = a.Id
WHERE   a.ActionDateTime >= @d0 AND a.ActionDateTime < @d1
GROUP BY l.AdjudicationOutcome ORDER BY Lines DESC;
SELECT  Section = 'B7b NAuthLine one day', ElapsedMs = DATEDIFF(MILLISECOND, @t, SYSDATETIME());

/* B8 — insured till sales: does the till header carry the payer? */
SET @t = SYSDATETIME();
SELECT  Trx = COUNT(*), WithNphiesPayer = SUM(x.wp), WithApproval = SUM(x.wa), PayerInNPayer = SUM(x.pn), ApprovalIsNAuth = SUM(x.an)
FROM   (SELECT wp = CASE WHEN ISNULL(t.NphiesPayerCode,'') <> '' THEN 1 ELSE 0 END,
               wa = CASE WHEN ISNULL(t.InsuranceApproval,'') <> '' THEN 1 ELSE 0 END,
               pn = CASE WHEN EXISTS (SELECT 1 FROM NPayer n WHERE n.PayerCode = t.NphiesPayerCode) THEN 1 ELSE 0 END,
               an = CASE WHEN t.InsuranceApproval <> '' AND EXISTS (SELECT 1 FROM NAuth a WHERE a.ActionDateTime >= DATEADD(DAY,-7,@d0) AND CAST(a.Id AS VARCHAR(50)) = t.InsuranceApproval) THEN 1 ELSE 0 END
        FROM RetailTrx t WHERE t.TrxDate >= @d0 AND t.TrxDate < @d1) x;
SELECT  Section = 'B8 insured till sales', ElapsedMs = DATEDIFF(MILLISECOND, @t, SYSDATETIME());
