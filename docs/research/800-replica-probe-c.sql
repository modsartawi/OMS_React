/* 793 / ticket 800 — stage C and D follow-ups (2026-11-06). READ-ONLY, aggregates only.
   c1–c5 and d1 ran as separate sqlcmd -i calls; the four short -Q checks are quoted in 793-v2-sources-on-the-replica.md §5. */

-- ===================== c1
SET NOCOUNT ON; SET ANSI_WARNINGS OFF; DECLARE @d1 DATETIME = CAST(CAST(GETDATE() AS DATE) AS DATETIME); DECLARE @d0 DATETIME = DATEADD(DAY,-1,@d1), @d30 DATETIME = DATEADD(DAY,-30,@d1); DECLARE @t DATETIME2 = SYSDATETIME();
SELECT TOP 8 [Year],[Month], Rows_=COUNT(*), CouponRows=SUM(CASE WHEN CouponCode<>'' THEN 1 ELSE 0 END), BbyRows=SUM(CASE WHEN BbyNumber<>'' THEN 1 ELSE 0 END), BBCodeRows=SUM(CASE WHEN ISNULL(BBCode,'')<>'' THEN 1 ELSE 0 END), PromoRows=SUM(CASE WHEN PromoNumber<>'' OR PromoNo<>'' THEN 1 ELSE 0 END), CondAmount=SUM(CondAmount) FROM RetailTrxCondition GROUP BY [Year],[Month] ORDER BY [Year] DESC,[Month] DESC;
SELECT ElapsedMs = DATEDIFF(MILLISECOND, @t, SYSDATETIME());

-- ===================== c2
SET NOCOUNT ON; SET ANSI_WARNINGS OFF; DECLARE @d1 DATETIME = CAST(CAST(GETDATE() AS DATE) AS DATETIME); DECLARE @d0 DATETIME = DATEADD(DAY,-1,@d1), @d30 DATETIME = DATEADD(DAY,-30,@d1); DECLARE @t DATETIME2 = SYSDATETIME();
SELECT TOP 15 PayTypeID, Payments=COUNT(*), Amount=SUM(Amount), WithLoyaltyId=SUM(CASE WHEN LoyaltyCustomerID<>'' THEN 1 ELSE 0 END), WithRequestId=SUM(CASE WHEN RequestId<>'' THEN 1 ELSE 0 END), WithReference=SUM(CASE WHEN ReferenceNumber<>'' THEN 1 ELSE 0 END) FROM RetailTrxPayment WHERE [Year]=YEAR(@d0) AND [Month]=MONTH(@d0) AND TrxDate>=@d0 AND TrxDate<@d1 GROUP BY PayTypeID ORDER BY Payments DESC;
SELECT ElapsedMs = DATEDIFF(MILLISECOND, @t, SYSDATETIME());

-- ===================== c3
SET NOCOUNT ON; SET ANSI_WARNINGS OFF; DECLARE @d1 DATETIME = CAST(CAST(GETDATE() AS DATE) AS DATETIME); DECLARE @d0 DATETIME = DATEADD(DAY,-1,@d1), @d30 DATETIME = DATEADD(DAY,-30,@d1); DECLARE @t DATETIME2 = SYSDATETIME();
SELECT h.DocumentCategory, l.ApprovalStatus, Lines=COUNT(*), Orders=COUNT(DISTINCT l.DocumentNo), OrdersWithPayer=COUNT(DISTINCT CASE WHEN h.PayerCode<>'' THEN l.DocumentNo END), CouponLines=SUM(CASE WHEN l.PromotionCouponCode<>'' THEN 1 ELSE 0 END), CouponDiscount=SUM(l.PromotionCouponDiscount) FROM SdDocumentHeader h JOIN SdDocumentLine l ON l.DocumentNo=h.DocumentNo WHERE h.EntryTime>=@d30 AND h.EntryTime<@d1 GROUP BY h.DocumentCategory, l.ApprovalStatus ORDER BY Lines DESC;
SELECT ElapsedMs = DATEDIFF(MILLISECOND, @t, SYSDATETIME());

-- ===================== c4
SET NOCOUNT ON; SET ANSI_WARNINGS OFF; DECLARE @d1 DATETIME = CAST(CAST(GETDATE() AS DATE) AS DATETIME); DECLARE @d0 DATETIME = DATEADD(DAY,-1,@d1), @d30 DATETIME = DATEADD(DAY,-30,@d1); DECLARE @t DATETIME2 = SYSDATETIME();
WITH r AS (SELECT ActivityType, RequestId, ReferenceNumber, BranchId, PointsAmountInCurrency FROM LoyActivity WHERE ActivityDateTime>=@d0 AND ActivityDateTime<@d1 AND ActivityTypeGroup='R'),
 p AS (SELECT DISTINCT RequestId FROM RetailTrxPayment WHERE [Year]=YEAR(@d0) AND [Month]=MONTH(@d0) AND TrxDate>=@d0 AND TrxDate<@d1 AND RequestId<>''),
 pr AS (SELECT DISTINCT ReferenceNumber FROM RetailTrxPayment WHERE [Year]=YEAR(@d0) AND [Month]=MONTH(@d0) AND TrxDate>=@d0 AND TrxDate<@d1 AND ReferenceNumber<>''),
 tx AS (SELECT DISTINCT StoreCode, TrxNumber FROM RetailTrx WHERE TrxDate>=@d0 AND TrxDate<@d1)
SELECT r.ActivityType, Redemptions=COUNT(*), PointsInCurrency=SUM(r.PointsAmountInCurrency),
  ReqInPayment=SUM(CASE WHEN p.RequestId IS NOT NULL THEN 1 ELSE 0 END), RefInPaymentRef=SUM(CASE WHEN pr.ReferenceNumber IS NOT NULL THEN 1 ELSE 0 END), RefIsTrx=SUM(CASE WHEN tx.TrxNumber IS NOT NULL THEN 1 ELSE 0 END),
  AvgLenReq=AVG(LEN(r.RequestId)), AvgLenRef=AVG(LEN(r.ReferenceNumber))
FROM r LEFT JOIN p ON p.RequestId=r.RequestId LEFT JOIN pr ON pr.ReferenceNumber=r.ReferenceNumber LEFT JOIN tx ON tx.StoreCode=r.BranchId AND tx.TrxNumber=r.ReferenceNumber
GROUP BY r.ActivityType;
SELECT ElapsedMs = DATEDIFF(MILLISECOND, @t, SYSDATETIME());
SELECT IsExpiry=CASE WHEN a.ActivityTypeGroup='E' THEN 1 ELSE 0 END, Rows_=COUNT(*), Branches=COUNT(DISTINCT a.BranchId), BranchInStore=SUM(CASE WHEN s.StoreCode IS NOT NULL THEN 1 ELSE 0 END) FROM LoyActivity a LEFT JOIN Store s ON s.StoreCode=a.BranchId WHERE a.ActivityDateTime>=@d0 AND a.ActivityDateTime<@d1 GROUP BY CASE WHEN a.ActivityTypeGroup='E' THEN 1 ELSE 0 END;

-- ===================== c5
SET NOCOUNT ON; SET ANSI_WARNINGS OFF; DECLARE @d1 DATETIME = CAST(CAST(GETDATE() AS DATE) AS DATETIME); DECLARE @d0 DATETIME = DATEADD(DAY,-1,@d1), @d30 DATETIME = DATEADD(DAY,-30,@d1); DECLARE @t DATETIME2 = SYSDATETIME();
SELECT c.column_id, c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.NAuth') ORDER BY c.column_id;
SELECT TOP 10 ClaimRequestType, ClaimType, Auths=COUNT(*) FROM NAuth WHERE ActionDateTime>=@d0 AND ActionDateTime<@d1 GROUP BY ClaimRequestType, ClaimType ORDER BY Auths DESC;

-- ===================== d1
SET NOCOUNT ON; SET ANSI_WARNINGS OFF;
DECLARE @d1 DATETIME = CAST(CAST(GETDATE() AS DATE) AS DATETIME); DECLARE @d0 DATETIME = DATEADD(DAY,-1,@d1); DECLARE @t DATETIME2 = SYSDATETIME();
SELECT Kind = CASE WHEN c.CouponCode <> '' THEN 'coupon' WHEN c.BbyNumber <> '' THEN 'bonus buy' WHEN c.PromoNumber <> '' OR c.PromoNo <> '' THEN 'promo' ELSE 'other' END,
       Rows_ = COUNT(*), CondAmount = SUM(c.CondAmount), DiscountAmount = SUM(c.DiscountAmount), Coupons = COUNT(DISTINCT NULLIF(c.CouponCode,'')), Bbys = COUNT(DISTINCT NULLIF(c.BbyNumber,'')),
       InfoOnly = SUM(CAST(c.IsInfoOnly AS INT)), Disabled = SUM(CAST(c.IsDisabled AS INT))
FROM RetailTrx t JOIN RetailTrxCondition c ON c.Client = t.Client AND c.StoreCode = t.StoreCode AND c.MachineCode = t.MachineCode AND c.TrxNumber = t.TrxNumber
WHERE t.TrxDate >= @d0 AND t.TrxDate < @d1
GROUP BY CASE WHEN c.CouponCode <> '' THEN 'coupon' WHEN c.BbyNumber <> '' THEN 'bonus buy' WHEN c.PromoNumber <> '' OR c.PromoNo <> '' THEN 'promo' ELSE 'other' END;
SELECT Section = 'D1 RetailTrxCondition one day via RetailTrx', ElapsedMs = DATEDIFF(MILLISECOND, @t, SYSDATETIME());
SET @t = SYSDATETIME();
SELECT Bbys = COUNT(*), InBBHeader = SUM(y.inH), InBonusbuy = SUM(y.inB)
FROM (SELECT inH = CASE WHEN EXISTS (SELECT 1 FROM BBHeader h WHERE h.BBCode = x.BbyNumber) THEN 1 ELSE 0 END,
             inB = CASE WHEN EXISTS (SELECT 1 FROM Bonusbuy b WHERE b.Code = x.BbyNumber) THEN 1 ELSE 0 END
      FROM (SELECT DISTINCT c.BbyNumber FROM RetailTrx t JOIN RetailTrxCondition c ON c.Client = t.Client AND c.StoreCode = t.StoreCode AND c.MachineCode = t.MachineCode AND c.TrxNumber = t.TrxNumber
            WHERE t.TrxDate >= @d0 AND t.TrxDate < @d1 AND c.BbyNumber <> '') x) y;
SELECT Section = 'D1b bby key match', ElapsedMs = DATEDIFF(MILLISECOND, @t, SYSDATETIME());
SET @t = SYSDATETIME();
WITH a AS (SELECT ClaimType, ClaimRequestType, RefDocumentNo, InvoiceNo, DispensedStore, IsDispensed, ClaimSubmitted, AdjudicationOutcome, Submitted, Benefit, PatientShare FROM NAuth WHERE ActionDateTime >= @d0 AND ActionDateTime < @d1),
     tx AS (SELECT DISTINCT TrxNumber FROM RetailTrx WHERE TrxDate >= DATEADD(DAY,-3,@d0) AND TrxDate < DATEADD(DAY,3,@d1))
SELECT a.ClaimType, a.ClaimRequestType, a.AdjudicationOutcome, Auths = COUNT(*),
       WithRefDoc = SUM(CASE WHEN a.RefDocumentNo <> '' THEN 1 ELSE 0 END), RefDocIsOrder = SUM(CASE WHEN h.DocumentNo IS NOT NULL THEN 1 ELSE 0 END),
       WithInvoice = SUM(CASE WHEN a.InvoiceNo <> '' THEN 1 ELSE 0 END), InvoiceIsTrx = SUM(CASE WHEN tx.TrxNumber IS NOT NULL THEN 1 ELSE 0 END),
       Dispensed = SUM(CASE WHEN a.IsDispensed = 1 THEN 1 ELSE 0 END), WithDispStore = SUM(CASE WHEN a.DispensedStore <> '' THEN 1 ELSE 0 END),
       ClaimSubmitted = SUM(CASE WHEN a.ClaimSubmitted = 1 THEN 1 ELSE 0 END), Submitted = SUM(a.Submitted), Benefit = SUM(a.Benefit), PatientShare = SUM(a.PatientShare)
FROM a LEFT JOIN SdDocumentHeader h ON h.DocumentNo = a.RefDocumentNo LEFT JOIN tx ON tx.TrxNumber = a.InvoiceNo
GROUP BY a.ClaimType, a.ClaimRequestType, a.AdjudicationOutcome ORDER BY Auths DESC;
SELECT Section = 'D2 NAuth keys one day', ElapsedMs = DATEDIFF(MILLISECOND, @t, SYSDATETIME());
