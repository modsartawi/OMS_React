/* ============================================================================================
   793 / ticket 800 — stage A: are the v2 areas' tables on the replica?  READ-ONLY.
   Target : 172.23.27.47 / POS (DWPOSREPL03), the `read` login. Catalog reads only, no data.
   Run    : the sanctioned sqlcmd shape (see 741-replica-probe.sql) with -i this file -o *.out.txt
   ============================================================================================ */
SET NOCOUNT ON;

/* A1 — every candidate table, any schema: rows, index kinds */
SELECT  SchemaName = s.name, TableName = t.name, t.create_date,
        [Rows]   = (SELECT SUM(p.rows) FROM sys.partitions p WHERE p.object_id = t.object_id AND p.index_id IN (0,1)),
        Indexes  = STUFF((SELECT ',' + i.type_desc + CASE WHEN i.is_primary_key = 1 THEN '(PK)' ELSE '' END
                          FROM sys.indexes i WHERE i.object_id = t.object_id AND i.type > 0
                          ORDER BY i.index_id FOR XML PATH('')), 1, 1, '')
FROM    sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE   t.name LIKE 'Coupon%' OR t.name LIKE 'Loy%' OR t.name LIKE 'Nphies%' OR t.name LIKE 'Bby%'
   OR   t.name LIKE 'RetailTrxCondition%' OR t.name LIKE 'RetailTrxBonus%' OR t.name LIKE 'RetailTrxDetailPromo%'
   OR   t.name LIKE 'PaymentDiscount%' OR t.name LIKE 'SdDocumentInsurance%' OR t.name LIKE 'InsuranceAuth%'
   OR   t.name LIKE 'Payer%' OR t.name LIKE '%Payer' OR t.name IN ('DeliveryHeader','SdDocumentLine','RetailTrxPayment','RetailTrx')
ORDER BY t.name;

/* A2 — the ticket's named tables: present or MISSING */
SELECT  t.TableName,
        Present = CASE WHEN EXISTS (SELECT 1 FROM sys.tables x WHERE x.name = t.TableName) THEN 'yes' ELSE 'MISSING' END
FROM (VALUES ('CouponTransaction'),('CouponInstance'),('CouponTemplate'),('RetailTrxCondition'),
             ('RetailTrxBonusbuy'),('RetailTrxDetailPromo'),('BbyHeader'),('PaymentDiscountCampaign'),
             ('LoyActivity'),('LoyActivityLine'),('LoyMembership'),('LoyTier'),('LoyMember'),('LoyCampaign'),
             ('NphiesTrxClaimHeader'),('NphiesTrxClaimLine'),('SdDocumentInsurance'),('InsuranceAuthFhir'),
             ('DeliveryHeader')) AS t(TableName)
ORDER BY Present, t.TableName;

/* A3 — replication: subscriptions, and which publication carries which article */
IF OBJECT_ID('dbo.MSreplication_subscriptions') IS NOT NULL
    EXEC('SELECT publisher, publisher_db, publication, [time] AS LastAgentWrite FROM dbo.MSreplication_subscriptions ORDER BY publisher, publication');
IF OBJECT_ID('dbo.MSreplication_objects') IS NOT NULL
    EXEC('SELECT DISTINCT publisher, publisher_db, publication, article
          FROM dbo.MSreplication_objects
          WHERE article LIKE ''Coupon%'' OR article LIKE ''Loy%'' OR article LIKE ''Nphies%'' OR article LIKE ''Bby%''
             OR article LIKE ''RetailTrxCondition%'' OR article LIKE ''RetailTrxBonus%'' OR article LIKE ''RetailTrxDetailPromo%''
             OR article LIKE ''PaymentDiscount%'' OR article LIKE ''SdDocumentInsurance%'' OR article LIKE ''InsuranceAuth%''
             OR article LIKE ''%Payer%'' OR article = ''DeliveryHeader''
          ORDER BY article, publication');
ELSE SELECT 'no MSreplication_objects visible' AS A3;

/* A4 — columns of the tables the measures read */
SELECT  TableName = t.name, c.column_id, ColumnName = c.name, TypeName = ty.name, c.max_length, c.is_nullable
FROM    sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
JOIN    sys.types ty ON ty.user_type_id = c.user_type_id
WHERE   t.name IN ('CouponTransaction','CouponInstance','CouponTemplate','RetailTrxCondition','RetailTrxBonusbuy',
                   'RetailTrxDetailPromo','BbyHeader','PaymentDiscountCampaign','LoyActivity','LoyActivityLine',
                   'LoyMembership','LoyTier','LoyMember','LoyCampaign','NphiesTrxClaimHeader','NphiesTrxClaimLine',
                   'SdDocumentInsurance')
ORDER BY t.name, c.column_id;

/* A5 — key columns of every rowstore index on those tables (does any lead on a date?) */
SELECT  TableName = OBJECT_NAME(ic.object_id), IndexName = i.name, i.type_desc, ic.key_ordinal, ColumnName = c.name
FROM    sys.index_columns ic
JOIN    sys.indexes i ON i.object_id = ic.object_id AND i.index_id = ic.index_id
JOIN    sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE   OBJECT_NAME(ic.object_id) IN ('CouponTransaction','CouponInstance','CouponTemplate','RetailTrxCondition',
                   'RetailTrxBonusbuy','RetailTrxDetailPromo','BbyHeader','LoyActivity','LoyActivityLine','LoyMembership',
                   'LoyMember','NphiesTrxClaimHeader','NphiesTrxClaimLine','SdDocumentInsurance')
  AND   i.type NOT IN (5,6) AND ic.is_included_column = 0
ORDER BY TableName, IndexName, ic.key_ordinal;

/* A6 — RetailTrxPayment's columns (the loyalty-redemption key) and SdDocumentLine's */
SELECT  TableName = t.name, ColumnName = c.name, TypeName = ty.name
FROM    sys.tables t JOIN sys.columns c ON c.object_id = t.object_id JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE   t.name IN ('RetailTrxPayment','SdDocumentLine') ORDER BY t.name, c.column_id;
