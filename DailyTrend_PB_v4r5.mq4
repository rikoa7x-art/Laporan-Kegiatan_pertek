#property copyright "DailyTrend_PB v4r5"
#property link      ""
#property version   "4.50"
#property strict
#property indicator_chart_window
#property indicator_buffers 6

#property indicator_color1 clrDodgerBlue
#property indicator_color2 clrOrangeRed
#property indicator_color3 clrGray
#property indicator_color4 clrWhite
#property indicator_color5 clrRed
#property indicator_color6 clrLime

//=== Channel 2 Hari ===
input string              _s1_           = "=== Channel 2 Hari ===";
input int                 DayPeriod      = 2;
input ENUM_MA_METHOD      ChMethod       = MODE_LWMA;
input ENUM_APPLIED_PRICE  ChApplyHi      = PRICE_HIGH;
input ENUM_APPLIED_PRICE  ChApplyLo      = PRICE_LOW;

//=== Weekly LWMA ===
input string              _s2_           = "=== Weekly LWMA ===";
input int                 WeekMult       = 1;
input ENUM_APPLIED_PRICE  WeekApply      = PRICE_CLOSE;
input int                 WkWidth        = 3;
input color               WkColor        = clrWhite;

//=== Filter Opsional ===
input string              _s3_             = "=== Filter (opsional) ===";
input bool                UseWeeklyFilter  = false;
input bool                UseChTrend       = false;
input int                 TrendBars        = 0;
input bool                BothLines        = true;
input bool                FilterOnFlip     = false;

//=== Daily Candle ===
input string              _s4_             = "=== Daily Candle ===";
input double              MinBodyPct       = 30.0;

//=== Pullback Entry ===
enum ENUM_PB
{
   PB_NEAR    = 0,  // Sisi dekat (pullback dangkal)
   PB_MIDDLE  = 1,  // Tengah channel
   PB_FAR     = 2   // Sisi jauh (pullback dalam)
};

input string              _s5_             = "=== Pullback Entry ===";
input ENUM_PB             PBMode           = PB_NEAR;
input double              PBTolerance      = 0.2;
input bool                NeedConfCandle   = false;

//=== Konfirmasi 3 Jam — MA Turn Detection [v4r5] ===
input string              _s5x_            = "=== Konfirmasi 3 Jam (MA Turn) ===";
input bool                Use4HConfirm     = true;       // Aktifkan filter 3 jam (nama variabel tetap Use4HConfirm agar aman)
input int                 ConfirmHours     = 3;          // Berapa jam untuk MA
input ENUM_MA_METHOD      ConfirmMAMethod  = MODE_SMA;    // Metode MA konfirmasi
input ENUM_APPLIED_PRICE  ConfirmPrice     = PRICE_CLOSE; // Applied price
input int                 SlopeCheckBars   = 2;           // Berapa bar hitung slope
input int                 TurnWindow       = 3;           // Window deteksi MA turn (bars)

//=== Daily Range Check ===
input string              _s5c_              = "=== Daily Range Check ===";
input bool                UseDailyRangeCheck = true;
input int                 DRC_ATR_Period     = 20;
input double              MaxRangePct        = 80.0;

//=== Signal Control ===
input string              _s5b_            = "=== Signal Control ===";
input bool                OnlyOnePerDay    = false;

//=== Display ===
input string              _s6_         = "=== Display ===";
input int                 ChWidth      = 2;
input bool                ShowMid      = true;
input bool                ShowPanel    = true;
input int                 PanelX       = 10;
input int                 PanelY       = 30;

//=== Alert ===
input string              _s7_     = "=== Alert ===";
input bool                DoAlert  = true;
input bool                DoPush   = false;
input bool                DoMail   = false;
input bool                DoSound  = true;
input string              SndFile  = "alert.wav";

//--- Buffers
double BufHi[], BufLo[], BufMd[], BufWk[], BufSell[], BufBuy[];

//--- State
struct DayData { datetime day; double hi, lo; };
struct Setup   { datetime doneDay; };

DayData  DD, SnapDD;
Setup    BuyS, SellS, SnapBuyS, SnapSellS;
int      SnapBars;
datetime LastAlertT;
int      ChPer, WkPer, TrPer, ConfPer;
int      TurnWin, SlopeChk;   // [v4r5] internal validated values
string   PX = "DTP5_";

//+------------------------------------------------------------------+
int OnInit()
{
   int tf = Period();
   if(tf <= 0) tf = 1;
   int bpd = (24 * 60) / tf;

   ChPer = MathMax(bpd * DayPeriod, 2);
   WkPer = MathMax(bpd * 5 * WeekMult, 5);
   TrPer = (TrendBars > 0) ? TrendBars : MathMax(ChPer / 4, 3);

   //--- [v4r5] Hitung & validasi parameter konfirmasi
   ConfPer  = MathMax((ConfirmHours * 60) / tf, 2);
   SlopeChk = MathMax(SlopeCheckBars, 1);
   TurnWin  = MathMax(TurnWindow, 1);

   if(ConfPer < 5 && Use4HConfirm)
   {
      Print("WARNING: ConfPer=", ConfPer,
            " terlalu kecil di TF ", TFName(),
            ". Naikkan ConfirmHours atau turunkan TF.");
   }

   ZeroMemory(DD);     ZeroMemory(BuyS);     ZeroMemory(SellS);
   ZeroMemory(SnapDD); ZeroMemory(SnapBuyS); ZeroMemory(SnapSellS);
   SnapBars = 0;
   LastAlertT = 0;

   SetIndexBuffer(0, BufHi);   SetIndexBuffer(1, BufLo);
   SetIndexBuffer(2, BufMd);   SetIndexBuffer(3, BufWk);
   SetIndexBuffer(4, BufSell); SetIndexBuffer(5, BufBuy);

   SetIndexStyle(0, DRAW_LINE,  STYLE_SOLID, ChWidth, clrDodgerBlue);
   SetIndexStyle(1, DRAW_LINE,  STYLE_SOLID, ChWidth, clrOrangeRed);
   SetIndexStyle(2, ShowMid ? DRAW_LINE : DRAW_NONE, STYLE_DOT, 1, clrGray);
   SetIndexStyle(3, DRAW_LINE,  STYLE_SOLID, WkWidth, WkColor);
   SetIndexStyle(4, DRAW_ARROW, STYLE_SOLID, 1, clrRed);
   SetIndexStyle(5, DRAW_ARROW, STYLE_SOLID, 1, clrLime);
   SetIndexArrow(4, 234);
   SetIndexArrow(5, 233);

   SetIndexLabel(0, "Ch Hi");   SetIndexLabel(1, "Ch Lo");
   SetIndexLabel(2, "Ch Mid");  SetIndexLabel(3, "Wk LWMA");
   SetIndexLabel(4, "SELL");    SetIndexLabel(5, "BUY");

   IndicatorShortName("DailyTrPB_v4r5");

   Print("MA Turn: ConfPer=", ConfPer,
         " SlopeChk=", SlopeChk,
         " TurnWin=", TurnWin,
         " (TF=", TFName(), ", ", ConfirmHours, " jam)");

   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
int OnCalculate(const int rates_total, const int prev_calculated,
                const datetime &time[],  const double &open[],
                const double &high[],    const double &low[],
                const double &close[],   const long &tick_volume[],
                const long &volume[],    const int &spread[])
{
   //--- [v4r5] Hitung kebutuhan bar termasuk slope + turn window
   int confNeed = ConfPer + SlopeChk + TurnWin + 2;
   int maxPer   = MathMax(MathMax(ChPer, WkPer), confNeed);
   int need     = maxPer + TrPer + 20;
   if(rates_total < need) return 0;

   int limit;
   if(prev_calculated == 0)
   {
      limit = rates_total - maxPer - 1;
      ArrayInitialize(BufHi,   EMPTY_VALUE);
      ArrayInitialize(BufLo,   EMPTY_VALUE);
      ArrayInitialize(BufMd,   EMPTY_VALUE);
      ArrayInitialize(BufWk,   EMPTY_VALUE);
      ArrayInitialize(BufSell, EMPTY_VALUE);
      ArrayInitialize(BufBuy,  EMPTY_VALUE);
      ZeroMemory(DD); ZeroMemory(BuyS); ZeroMemory(SellS);
      SnapBars = 0;
   }
   else
   {
      limit = rates_total - prev_calculated;
      if(limit < 0) limit = 0;
   }
   if(limit > rates_total - maxPer - 1)
      limit = rates_total - maxPer - 1;

   //--- Channel & Weekly MA
   for(int i = limit; i >= 0; i--)
   {
      double h = iMA(NULL, 0, ChPer, 0, ChMethod, ChApplyHi, i);
      double l = iMA(NULL, 0, ChPer, 0, ChMethod, ChApplyLo, i);
      if(h > 0 && l > 0)
      { BufHi[i] = h; BufLo[i] = l; BufMd[i] = (h + l) / 2.0; }
      else
      { BufHi[i] = EMPTY_VALUE; BufLo[i] = EMPTY_VALUE; BufMd[i] = EMPTY_VALUE; }

      double w = iMA(NULL, 0, WkPer, 0, MODE_LWMA, WeekApply, i);
      BufWk[i] = (w > 0) ? w : EMPTY_VALUE;
   }

   //--- Signal processing
   if(prev_calculated == 0)
   {
      DayData lDD; Setup lBuy, lSell;
      ZeroMemory(lDD); ZeroMemory(lBuy); ZeroMemory(lSell);
      for(int i = limit; i >= 0; i--)
      {
         BufSell[i] = EMPTY_VALUE;
         BufBuy[i]  = EMPTY_VALUE;
         TrackDay(i, lDD);
         DoBuy(i, lBuy, lSell, lDD);
         DoSell(i, lSell, lBuy, lDD);
      }
      DD = lDD; BuyS = lBuy; SellS = lSell;
      SnapDD = lDD; SnapBuyS = lBuy; SnapSellS = lSell;
      SnapBars = Bars;
   }
   else
   {
      if(Bars != SnapBars)
      { SnapDD = DD; SnapBuyS = BuyS; SnapSellS = SellS; SnapBars = Bars; }
      else
      { DD = SnapDD; BuyS = SnapBuyS; SellS = SnapSellS; }

      BufSell[0] = EMPTY_VALUE;
      BufBuy[0]  = EMPTY_VALUE;
      TrackDay(0, DD);
      DoBuy(0, BuyS, SellS, DD);
      DoSell(0, SellS, BuyS, DD);
   }

   if(ShowPanel) DrawPanel();
   return rates_total;
}

//+------------------------------------------------------------------+
//|  TRACKING & DATA                                                 |
//+------------------------------------------------------------------+
void TrackDay(int i, DayData &dd)
{
   if(i >= Bars) return;
   int ds = iBarShift(NULL, PERIOD_D1, Time[i], false);
   if(ds < 0) return;
   datetime bd = iTime(NULL, PERIOD_D1, ds);
   if(bd != dd.day)
   { dd.day = bd; dd.hi = High[i]; dd.lo = Low[i]; }
   else
   { if(High[i] > dd.hi) dd.hi = High[i];
     if(Low[i]  < dd.lo) dd.lo = Low[i]; }
}

bool GetYesterday(int i, double &yH, double &yL)
{
   if(i >= Bars) return false;
   int ds = iBarShift(NULL, PERIOD_D1, Time[i], false);
   int dt = iBars(NULL, PERIOD_D1);
   if(ds < 0 || ds + 1 >= dt) return false;
   yH = iHigh(NULL, PERIOD_D1, ds + 1);
   yL = iLow(NULL,  PERIOD_D1, ds + 1);
   return (yH > 0 && yL > 0);
}

datetime BarDay(int i)
{
   if(i >= Bars) return 0;
   int ds = iBarShift(NULL, PERIOD_D1, Time[i], false);
   if(ds < 0) return 0;
   return iTime(NULL, PERIOD_D1, ds);
}

//+------------------------------------------------------------------+
//|  YESTERDAY DIRECTION                                             |
//+------------------------------------------------------------------+
int YesterdayDir(int i)
{
   if(i >= Bars) return 0;
   int ds = iBarShift(NULL, PERIOD_D1, Time[i], false);
   int dt = iBars(NULL, PERIOD_D1);
   if(ds < 0 || ds + 1 >= dt) return 0;

   double yO = iOpen(NULL,  PERIOD_D1, ds + 1);
   double yC = iClose(NULL, PERIOD_D1, ds + 1);
   double yH = iHigh(NULL,  PERIOD_D1, ds + 1);
   double yL = iLow(NULL,   PERIOD_D1, ds + 1);
   if(yH <= yL || yH == 0) return 0;

   double body  = MathAbs(yC - yO);
   double range = yH - yL;
   if(MinBodyPct > 0 && (body / range * 100.0) < MinBodyPct)
      return 0;

   if(yC > yO) return  1;
   if(yC < yO) return -1;
   return 0;
}

//+------------------------------------------------------------------+
//|  TODAY BIAS                                                      |
//+------------------------------------------------------------------+
int TodayBias(int i, DayData &dd, bool &isFlip)
{
   isFlip = false;
   int yd = YesterdayDir(i);
   if(yd == 0) return 0;

   double yH, yL;
   if(!GetYesterday(i, yH, yL)) return 0;

   if(yd == 1)
   {
      bool loBreak = (dd.lo < yL);
      bool hiBreak = (dd.hi > yH);
      if(loBreak && hiBreak) return 0;
      if(loBreak) { isFlip = true; return -1; }
      return 1;
   }
   else
   {
      bool hiBreak = (dd.hi > yH);
      bool loBreak = (dd.lo < yL);
      if(hiBreak && loBreak) return 0;
      if(hiBreak) { isFlip = true; return 1; }
      return -1;
   }
}

int TodayBias(int i, DayData &dd)
{ bool dummy; return TodayBias(i, dd, dummy); }

//+------------------------------------------------------------------+
//|  DAILY ATR                                                       |
//+------------------------------------------------------------------+
double GetDailyATR(int i)
{
   if(i >= Bars) return 0;
   int ds = iBarShift(NULL, PERIOD_D1, Time[i], false);
   int dt = iBars(NULL, PERIOD_D1);
   int startBar = ds + 1;
   if(startBar < 0 || startBar + DRC_ATR_Period + 1 >= dt) return 0;

   double sumTR = 0;
   for(int d = 0; d < DRC_ATR_Period; d++)
   {
      int bar = startBar + d;
      double hi    = iHigh(NULL,  PERIOD_D1, bar);
      double lo    = iLow(NULL,   PERIOD_D1, bar);
      double prevC = iClose(NULL, PERIOD_D1, bar + 1);
      double tr = hi - lo;
      double d1 = MathAbs(hi - prevC);
      double d2 = MathAbs(lo - prevC);
      if(d1 > tr) tr = d1;
      if(d2 > tr) tr = d2;
      sumTR += tr;
   }
   return sumTR / DRC_ATR_Period;
}

//+------------------------------------------------------------------+
//|  DAILY RANGE CHECK                                               |
//+------------------------------------------------------------------+
double GetRangePct(int i, DayData &dd)
{
   double atr = GetDailyATR(i);
   if(atr <= 0 || dd.day == 0) return 0;
   double range = dd.hi - dd.lo;
   if(range <= 0) return 0;
   return (range / atr) * 100.0;
}

bool IsDailyRangeExhausted(int i, DayData &dd)
{
   if(!UseDailyRangeCheck) return false;
   if(MaxRangePct <= 0) return false;
   return (GetRangePct(i, dd) >= MaxRangePct);
}

double GetPipSize()
{
   double pip = Point;
   if(Digits == 3 || Digits == 5) pip = Point * 10;
   if(pip <= 0) pip = Point;
   return pip;
}

void GetRangeInfo(int i, DayData &dd, double &rangePips, double &atrPips,
                  double &pct, string &status, color &clr)
{
   double pip = GetPipSize();

   double atr   = GetDailyATR(i);
   double range = (dd.day != 0) ? (dd.hi - dd.lo) : 0;

   rangePips = (pip > 0) ? range / pip : 0;
   atrPips   = (pip > 0) ? atr / pip   : 0;
   pct       = (atr > 0) ? (range / atr * 100.0) : 0;

   if(!UseDailyRangeCheck)
   { status = "OFF"; clr = clrGray; }
   else if(atr <= 0)
   { status = "No ATR data"; clr = clrGray; }
   else if(pct >= MaxRangePct)
   { status = "LEWAT BATAS!"; clr = clrRed; }
   else if(pct >= MaxRangePct * 0.85)
   { status = "Waspada"; clr = clrOrange; }
   else if(pct >= MaxRangePct * 0.6)
   { status = "Cukup"; clr = clrYellow; }
   else
   { status = "Aman"; clr = clrLime; }
}

//+------------------------------------------------------------------+
//|  KONFIRMASI 3 JAM — MA SLOPE TURN DETECTION [v4r5]               |
//+------------------------------------------------------------------+

//--- Hitung slope MA konfirmasi pada bar i
//    Positif = MA naik, Negatif = MA turun
double GetMASlope(int i)
{
   if(i + SlopeChk >= Bars) return 0;
   double maNow  = iMA(NULL, 0, ConfPer, 0, ConfirmMAMethod, ConfirmPrice, i);
   double maPrev = iMA(NULL, 0, ConfPer, 0, ConfirmMAMethod, ConfirmPrice,
                       i + SlopeChk);
   // Gunakan DBL_MIN bukan 0 agar tidak false-reject harga kecil yang valid
   if(maNow == EMPTY_VALUE || maPrev == EMPTY_VALUE) return 0;
   return maNow - maPrev;
}

//--- Deteksi: MA baru berbalik TURUN (slope flip dari + ke -)
//    Untuk SELL: koreksi naik sudah selesai, harga lanjut turun
bool DetectMATurnDown(int i)
{
   // Saat ini MA harus sudah turun
   double slopeCurrent = GetMASlope(i);
   if(slopeCurrent >= 0) return false;

   // Cari titik flip dalam window (mulai b=1 karena b=0 slope sudah negatif,
   // kita cari bar sebelumnya (b+1) yang masih positif)
   for(int b = 0; b < TurnWin; b++)
   {
      int bar = i + b;
      if(bar + 1 + SlopeChk >= Bars) continue;

      double sNow  = GetMASlope(bar);
      double sPrev = GetMASlope(bar + 1);

      // Slope bar sekarang negatif DAN bar sebelumnya positif = baru TURN DOWN
      if(sNow < 0 && sPrev > 0)
         return true;
   }
   return false;
}

//--- Deteksi: MA baru berbalik NAIK (slope flip dari - ke +)
//    Untuk BUY: koreksi turun sudah selesai, harga lanjut naik
bool DetectMATurnUp(int i)
{
   // Saat ini MA harus sudah naik
   double slopeCurrent = GetMASlope(i);
   if(slopeCurrent <= 0) return false;

   // Cari titik flip dalam window (cari transisi dari negatif ke positif)
   for(int b = 0; b < TurnWin; b++)
   {
      int bar = i + b;
      if(bar + 1 + SlopeChk >= Bars) continue;

      double sNow  = GetMASlope(bar);
      double sPrev = GetMASlope(bar + 1);

      // Slope bar sekarang positif DAN bar sebelumnya negatif = baru TURN UP
      if(sNow > 0 && sPrev < 0)
         return true;
   }
   return false;
}

//--- Fungsi gabungan: apakah konfirmasi 3 jam terpenuhi?
//    SELL: cukup MA sedang trending DOWN (slope negatif)
//    BUY : cukup MA sedang trending UP   (slope positif)
bool Is4HConfirmSell(int i)
{
   if(!Use4HConfirm) return true;
   return (GetMASlope(i) < 0);
}

bool Is4HConfirmBuy(int i)
{
   if(!Use4HConfirm) return true;
   return (GetMASlope(i) > 0);
}

//--- Info detail untuk panel [v4r5]
void Get4HInfo(int i, int dir,
               string &stateTxt, color &stateClr,
               string &slopeTxt, color &slopeClr,
               bool &isReady)
{
   if(!Use4HConfirm)
   {
      stateTxt = "OFF";  stateClr = clrGray;
      slopeTxt = "";     slopeClr = clrGray;
      isReady = true;
      return;
   }

   double slopeRaw  = GetMASlope(i);
   double pip       = GetPipSize();
   double slopePips = (pip > 0) ? slopeRaw / pip : 0;

   //--- Format slope text
   string sign = (slopePips >= 0) ? "+" : "";
   slopeTxt = "Slope: " + sign + DoubleToStr(slopePips, 1) + " pips/"
            + IntegerToString(SlopeChk) + " bar";

   //--- Build state text: SELL konfirm jika slope<0, BUY konfirm jika slope>0
   if(dir == -1) // SELL
   {
      if(slopeRaw < 0)
      {
         stateTxt = "MA Trending DOWN  OK";
         stateClr = clrLime;
         slopeClr = clrLime;
         isReady  = true;
      }
      else if(slopeRaw > 0)
      {
         stateTxt = "MA Trending UP  (Tunggu turun)";
         stateClr = clrOrange;
         slopeClr = clrOrange;
         isReady  = false;
      }
      else
      {
         stateTxt = "MA Flat  (Belum ada arah)";
         stateClr = clrDarkGray;
         slopeClr = clrGray;
         isReady  = false;
      }
   }
   else // BUY
   {
      if(slopeRaw > 0)
      {
         stateTxt = "MA Trending UP  OK";
         stateClr = clrLime;
         slopeClr = clrLime;
         isReady  = true;
      }
      else if(slopeRaw < 0)
      {
         stateTxt = "MA Trending DOWN  (Tunggu naik)";
         stateClr = clrOrange;
         slopeClr = clrOrange;
         isReady  = false;
      }
      else
      {
         stateTxt = "MA Flat  (Belum ada arah)";
         stateClr = clrDarkGray;
         slopeClr = clrGray;
         isReady  = false;
      }
   }
}

//+------------------------------------------------------------------+
//|  FILTERS                                                         |
//+------------------------------------------------------------------+
int WkBias(int i)
{
   if(i >= Bars || BufWk[i] == EMPTY_VALUE) return 0;
   if(Close[i] > BufWk[i]) return  1;
   if(Close[i] < BufWk[i]) return -1;
   return 0;
}

int ChTr(int i)
{
   if(i + TrPer >= Bars) return 0;
   if(BufHi[i] == EMPTY_VALUE || BufHi[i + TrPer] == EMPTY_VALUE) return 0;
   if(BufLo[i] == EMPTY_VALUE || BufLo[i + TrPer] == EMPTY_VALUE) return 0;

   bool hU = (BufHi[i] > BufHi[i + TrPer]);
   bool lU = (BufLo[i] > BufLo[i + TrPer]);
   bool hD = (BufHi[i] < BufHi[i + TrPer]);
   bool lD = (BufLo[i] < BufLo[i + TrPer]);

   if(BothLines) { if(hU && lU) return 1; if(hD && lD) return -1; }
   else          { if(hU || lU) return 1; if(hD || lD) return -1; }
   return 0;
}

bool IsFilterBlocked(int i, int dir, bool isFlip)
{
   if(isFlip && !FilterOnFlip) return false;

   if(UseWeeklyFilter)
   {
      int wb = WkBias(i);
      if(dir == 1 && wb == -1) return true;
      if(dir == -1 && wb == 1) return true;
   }
   if(UseChTrend)
   {
      int ct = ChTr(i);
      if(dir == 1 && ct == -1) return true;
      if(dir == -1 && ct == 1) return true;
   }
   return false;
}

//+------------------------------------------------------------------+
//|  PULLBACK CHECK                                                  |
//+------------------------------------------------------------------+
bool IsBuyPullback(int i)
{
   if(i >= Bars) return false;
   if(BufHi[i] == EMPTY_VALUE || BufLo[i] == EMPTY_VALUE) return false;
   double chW = BufHi[i] - BufLo[i];
   if(chW <= 0) return false;
   double tol = MathMax(chW * PBTolerance, Point * 5);

   double level;
   switch(PBMode)
   {
      case PB_NEAR:   level = BufHi[i]; break;
      case PB_MIDDLE:
         if(BufMd[i] == EMPTY_VALUE) return false; // guard jika mid belum dihitung
         level = BufMd[i]; break;
      default:        level = BufLo[i]; break;
   }
   if(Low[i] > level + tol) return false;
   if(High[i] < BufLo[i] - tol) return false;
   return true;
}

bool IsSellPullback(int i)
{
   if(i >= Bars) return false;
   if(BufHi[i] == EMPTY_VALUE || BufLo[i] == EMPTY_VALUE) return false;
   double chW = BufHi[i] - BufLo[i];
   if(chW <= 0) return false;
   double tol = MathMax(chW * PBTolerance, Point * 5);

   double level;
   switch(PBMode)
   {
      case PB_NEAR:   level = BufLo[i]; break;
      case PB_MIDDLE:
         if(BufMd[i] == EMPTY_VALUE) return false; // guard jika mid belum dihitung
         level = BufMd[i]; break;
      default:        level = BufHi[i]; break;
   }
   if(High[i] < level - tol) return false;
   if(Low[i] > BufHi[i] + tol) return false;
   return true;
}

//+------------------------------------------------------------------+
//|  SIGNAL ENTRY                                                    |
//+------------------------------------------------------------------+
void DoBuy(int i, Setup &s, Setup &otherS, DayData &dd)
{
   if(i >= Bars) return;
   if(BufHi[i] == EMPTY_VALUE || BufLo[i] == EMPTY_VALUE) return;
   double chW = BufHi[i] - BufLo[i];
   if(chW <= 0) return;

   datetime today = BarDay(i);
   if(today == 0) return;
   if(s.doneDay == today) return;
   if(OnlyOnePerDay && otherS.doneDay == today) return;

   bool isFlip;
   int bias = TodayBias(i, dd, isFlip);
   if(bias != 1) return;

   if(IsFilterBlocked(i, 1, isFlip)) return;
   if(IsDailyRangeExhausted(i, dd)) return;
   if(!IsBuyPullback(i)) return;
   if(Close[i] < BufLo[i] - chW * 0.5) return;
   if(NeedConfCandle && Close[i] <= Open[i]) return;

   //--- [v4r5] Konfirmasi: MA 3 jam baru berbalik NAIK
   if(!Is4HConfirmBuy(i)) return;

   BufBuy[i] = Low[i] - MathMax(chW * 0.3, Point * 10);
   s.doneDay = today;

   string tag = isFlip ? "FLIP BUY" : "BUY";
   SendAlert(tag, "MA Turn UP @ " + DoubleToStr(Close[i], Digits), i);
}

void DoSell(int i, Setup &s, Setup &otherS, DayData &dd)
{
   if(i >= Bars) return;
   if(BufHi[i] == EMPTY_VALUE || BufLo[i] == EMPTY_VALUE) return;
   double chW = BufHi[i] - BufLo[i];
   if(chW <= 0) return;

   datetime today = BarDay(i);
   if(today == 0) return;
   if(s.doneDay == today) return;
   if(OnlyOnePerDay && otherS.doneDay == today) return;

   bool isFlip;
   int bias = TodayBias(i, dd, isFlip);
   if(bias != -1) return;

   if(IsFilterBlocked(i, -1, isFlip)) return;
   if(IsDailyRangeExhausted(i, dd)) return;
   if(!IsSellPullback(i)) return;
   if(Close[i] > BufHi[i] + chW * 0.5) return;
   if(NeedConfCandle && Close[i] >= Open[i]) return;

   //--- [v4r5] Konfirmasi: MA 3 jam baru berbalik TURUN
   if(!Is4HConfirmSell(i)) return;

   BufSell[i] = High[i] + MathMax(chW * 0.3, Point * 10);
   s.doneDay = today;

   string tag = isFlip ? "FLIP SELL" : "SELL";
   SendAlert(tag, "MA Turn DOWN @ " + DoubleToStr(Close[i], Digits), i);
}

//+------------------------------------------------------------------+
//|  ALERT                                                           |
//+------------------------------------------------------------------+
void SendAlert(string type, string msg, int i)
{
   if(!DoAlert || i != 0 || Time[0] == LastAlertT) return;
   LastAlertT = Time[0];
   string full = Symbol() + " " + TFName()
               + " | " + type + ": " + msg;
   if(DoSound) PlaySound(SndFile);
   Alert(full);
   if(DoPush) SendNotification(full);
   if(DoMail) SendMail("DailyTrPB Alert", full);
}

//+------------------------------------------------------------------+
//|  PANEL [v4r5]                                                    |
//+------------------------------------------------------------------+
void DrawPanel()
{
   int x  = PanelX;
   int y  = PanelY;
   int pw = 420;
   int dy = 22;
   int pad = 8;
   int lx = x + pad;
   int vx = x + pad + 80;
   int headerH = 28;
   int bodyH   = 340;

   //=== Background ===
   DrawBG("hdr",  x, y,             pw, headerH, C'20,45,80',  C'40,90,150');
   DrawBG("body", x, y + headerH,  pw, bodyH,   C'18,22,30',  C'35,50,70');

   //=== Header ===
   PL("hdr_title", lx, y + 6, "DailyTrend PB v4r5", clrWhite, 10);
   PL("hdr_sym",   x + pw - 155, y + 6, Symbol() + "  " + TFName(), clrDodgerBlue, 10);

   int cy = y + headerH + pad;

   //=== SECTION 1: BIAS ===
   PL("lbl_sec1", lx, cy, "BIAS", C'100,110,130', 9);

   bool isFlip;
   int bias = TodayBias(0, DD, isFlip);
   int yd   = YesterdayDir(0);

   string biasTxt; color biasClr;
   if(bias == 0)
   {
      if(yd == 0) { biasTxt = "Kemarin DOJI / Body kecil";         biasClr = clrGray; }
      else        { biasTxt = "CHAOS - H+L kemarin tertembus";     biasClr = clrDarkGray; }
   }
   else if(bias == 1)
   {
      if(isFlip)  { biasTxt = "Kemarin TURUN >> FLIP BUY";         biasClr = clrLime; }
      else        { biasTxt = "Kemarin NAIK  >> Lanjut BUY";       biasClr = clrLime; }
   }
   else
   {
      if(isFlip)  { biasTxt = "Kemarin NAIK  >> FLIP SELL";        biasClr = clrOrangeRed; }
      else        { biasTxt = "Kemarin TURUN >> Lanjut SELL";      biasClr = clrOrangeRed; }
   }
   PL("val_bias", vx, cy, biasTxt, biasClr, 10);
   cy += dy;

   DrawSep("s1", lx, cy, pw - pad * 2);
   cy += 6;

   //=== SECTION 2: LEVEL ===
   PL("lbl_sec2", lx, cy, "LEVEL", C'100,110,130', 9);

   double yH = 0, yL = 0;
   if(GetYesterday(0, yH, yL) && DD.day != 0)
   {
      bool hBrk = (DD.hi > yH);
      bool lBrk = (DD.lo < yL);
      string hTxt = hBrk ? "High: BREAK" : "High: ---";
      string lTxt = lBrk ? "Low: BREAK"  : "Low: ---";
      color  hClr = hBrk ? clrLime       : clrGray;
      color  lClr = lBrk ? clrOrangeRed  : clrGray;
      PL("val_hi", vx,       cy, hTxt, hClr, 10);
      PL("val_lo", vx + 140, cy, lTxt, lClr, 10);
   }
   else
   {
      PL("val_hi", vx,       cy, "No data",  clrGray, 10);
      PL("val_lo", vx + 140, cy, "",          clrGray, 10);
   }
   cy += dy;

   DrawSep("s2", lx, cy, pw - pad * 2);
   cy += 6;

   //=== SECTION 3: RANGE ===
   PL("lbl_sec3", lx, cy, "RANGE", C'100,110,130', 9);

   double rPips = 0, aPips = 0, rPct = 0;
   string rStatus = ""; color rClr = clrGray;
   GetRangeInfo(0, DD, rPips, aPips, rPct, rStatus, rClr);

   string rTxt = DoubleToStr(rPips, 1) + " / " + DoubleToStr(aPips, 1)
               + " pips (" + DoubleToStr(rPct, 0) + "%)";
   PL("val_range", vx, cy, rTxt, clrWhite, 10);
   cy += dy;

   PL("lbl_bar", lx, cy, "", clrGray, 9);
   string bar = MakeBar(rPct) + "  " + rStatus;
   PL("val_bar", vx, cy, bar, rClr, 10);
   cy += dy;

   PL("lbl_atr", lx, cy, "", clrGray, 9);
   PL("val_atr", vx, cy, "ATR: SMA(" + IntegerToString(DRC_ATR_Period) + ") hari",
      C'80,90,110', 8);
   cy += dy;

   DrawSep("s3", lx, cy, pw - pad * 2);
   cy += 6;

   //=== SECTION 4: KONFIRMASI MA TURN [v4r5] ===
   PL("lbl_sec4h", lx, cy, "KONFIRM", C'100,110,130', 9);
   PL("val_sec4h_title", vx, cy,
      IntegerToString(ConfirmHours) + " Jam  |  MA("
      + IntegerToString(ConfPer) + ")  Turn("
      + IntegerToString(TurnWin) + ")"
      + (Use4HConfirm ? "" : "  [OFF]"),
      Use4HConfirm ? clrAqua : clrGray, 9);
   cy += dy;

   // Tampilkan berdasarkan bias aktif
   int dispDir = bias;
   if(dispDir == 0) dispDir = (yd > 0) ? 1 : -1; // yd==0 (doji) → default ke sell side

   string stateTxt = "", slopeTxt = "";
   color  stateClr = clrGray, slopeClr = clrGray;
   bool   isReady  = false; // inisialisasi sebelum dipakai
   Get4HInfo(0, dispDir, stateTxt, stateClr, slopeTxt, slopeClr, isReady);

   string icoTxt = isReady ? "+" : (stateClr == clrOrange ? "~" : "-");
   PL("ico_state", lx + 4, cy, icoTxt, stateClr, 10);
   PL("val_state", lx + 22, cy, stateTxt, stateClr, 9);
   cy += dy;

   PL("val_slope", lx + 22, cy, slopeTxt, slopeClr, 9);
   cy += dy;

   DrawSep("s4h", lx, cy, pw - pad * 2);
   cy += 6;

   //=== SECTION 5: FILTER ===
   PL("lbl_sec4", lx, cy, "FILTER", C'100,110,130', 9);

   string fTxt = "";
   if(UseWeeklyFilter || UseChTrend)
   {
      if(UseWeeklyFilter)
      {
         int wb = WkBias(0);
         fTxt = (wb == 1) ? "Weekly: Bull" : (wb == -1) ? "Weekly: Bear" : "Week: --";
      }
      if(UseChTrend)
      {
         int ct = ChTr(0);
         string cs = (ct == 1) ? "Chanel: Up" : (ct == -1) ? "Chanel: Down" : "Chanel: --";
         if(fTxt != "") fTxt += "   ";
         fTxt += cs;
      }
      if(isFlip && !FilterOnFlip) fTxt += "  (skip)";
   }
   else fTxt = "Semua OFF";

   PL("val_filter", vx, cy, fTxt, clrYellow, 10);
   cy += dy;

   PL("lbl_sec4b", lx, cy, "MODE", C'100,110,130', 9);
   string pbNames[] = {"NEAR", "MID", "FAR"};
   string mTxt = "PB: " + pbNames[PBMode];
   if(OnlyOnePerDay) mTxt += "   Max: 1/hari";
   if(NeedConfCandle) mTxt += "   Konfirmasi: ON";
   PL("val_mode", vx, cy, mTxt, clrSilver, 9);
   cy += dy;

   DrawSep("s4", lx, cy, pw - pad * 2);
   cy += 6;

   //=== SECTION 6: SIGNAL ===
   PL("lbl_sec5", lx, cy, "SIGNAL", C'100,110,130', 9);
   PL("val_sec5", vx, cy, "", clrGray, 9);
   cy += dy;

   string bTxt; color bClr;
   GetBuyStatus(bTxt, bClr);
   PL("ico_buy",  lx + 4, cy, CharToStr(233), clrLime, 12);
   PL("lbl_buy",  lx + 22, cy, "BUY", clrLime, 10);
   PL("val_buy",  vx, cy, bTxt, bClr, 10);
   cy += dy;

   string sTxt; color sClr;
   GetSellStatus(sTxt, sClr);
   PL("ico_sell", lx + 4, cy, CharToStr(234), clrOrangeRed, 12);
   PL("lbl_sell", lx + 22, cy, "SELL", clrOrangeRed, 10);
   PL("val_sell", vx, cy, sTxt, sClr, 10);
   cy += dy;

   int finalH = cy - (y + headerH) + pad;
   if(finalH != bodyH)
      DrawBG("body", x, y + headerH, pw, finalH, C'18,22,30', C'35,50,70');
}

//+------------------------------------------------------------------+
//|  STATUS HELPERS [v4r5]                                           |
//+------------------------------------------------------------------+
void GetBuyStatus(string &txt, color &clr)
{
   datetime today = BarDay(0);

   if(BuyS.doneDay == today)
   { txt = ">>> SIGNAL AKTIF <<<"; clr = clrLime; return; }

   if(OnlyOnePerDay && SellS.doneDay == today)
   { txt = "Blokir: SELL sudah ada"; clr = clrDarkGray; return; }

   bool isFlip;
   int bias = TodayBias(0, DD, isFlip);

   if(bias != 1)
   { txt = "Tidak ada signal"; clr = clrGray; return; }

   if(IsFilterBlocked(0, 1, isFlip))
   { txt = "Blokir: Filter"; clr = clrDarkGray; return; }

   if(IsDailyRangeExhausted(0, DD))
   { txt = "Blokir: Range penuh"; clr = clrDarkGray; return; }

   //--- Cek arah slope MA 3H
   if(Use4HConfirm && !Is4HConfirmBuy(0))
   {
      double s = GetMASlope(0);
      if(s < 0)
         txt = "3H: MA Trending DOWN  (Tunggu MA naik)";
      else
         txt = "3H: MA Flat  (Belum ada arah naik)";
      clr = clrDarkGray;
      return;
   }

   txt = isFlip ? "FLIP - Tunggu PB..." : "Tunggu Pullback...";
   clr = clrAqua;
}

//+------------------------------------------------------------------+
void GetSellStatus(string &txt, color &clr)
{
   datetime today = BarDay(0);

   if(SellS.doneDay == today)
   { txt = ">>> SIGNAL AKTIF <<<"; clr = clrOrangeRed; return; }

   if(OnlyOnePerDay && BuyS.doneDay == today)
   { txt = "Blokir: BUY sudah ada"; clr = clrDarkGray; return; }

   bool isFlip;
   int bias = TodayBias(0, DD, isFlip);

   if(bias != -1)
   { txt = "Tidak ada signal"; clr = clrGray; return; }

   if(IsFilterBlocked(0, -1, isFlip))
   { txt = "Blokir: Filter"; clr = clrDarkGray; return; }

   if(IsDailyRangeExhausted(0, DD))
   { txt = "Blokir: Range penuh"; clr = clrDarkGray; return; }

   //--- Cek arah slope MA 3H
   if(Use4HConfirm && !Is4HConfirmSell(0))
   {
      double s = GetMASlope(0);
      if(s > 0)
         txt = "3H: MA Trending UP  (Tunggu MA turun)";
      else
         txt = "3H: MA Flat  (Belum ada arah turun)";
      clr = clrDarkGray;
      return;
   }

   txt = isFlip ? "FLIP - Tunggu PB..." : "Tunggu Pullback...";
   clr = clrOrange;
}

//+------------------------------------------------------------------+
//|  HELPER: Panel Objects                                           |
//+------------------------------------------------------------------+
void PL(string tag, int xx, int yy, string text, color clr, int sz)
{
   string name = PX + "P_" + tag;
   if(ObjectFind(name) < 0)
   {
      ObjectCreate(name, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, name, OBJPROP_CORNER,      CORNER_LEFT_UPPER);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, name, OBJPROP_HIDDEN,      true);
   }
   // Update posisi setiap tick agar panel tidak geser
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, xx);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, yy);
   ObjectSetText(name, text, sz, "Consolas", clr);
}

//+------------------------------------------------------------------+
void DrawBG(string tag, int xx, int yy, int ww, int hh, color bgClr, color borderClr)
{
   string name = PX + "BG_" + tag;
   if(ObjectFind(name) < 0)
   {
      ObjectCreate(name, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(0, name, OBJPROP_CORNER,      CORNER_LEFT_UPPER);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE,   false);
      ObjectSetInteger(0, name, OBJPROP_HIDDEN,       true);
      ObjectSetInteger(0, name, OBJPROP_BACK,         false);
      ObjectSetInteger(0, name, OBJPROP_BORDER_TYPE,  BORDER_FLAT);
   }
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE,    xx);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE,    yy);
   ObjectSetInteger(0, name, OBJPROP_XSIZE,        ww);
   ObjectSetInteger(0, name, OBJPROP_YSIZE,        hh);
   ObjectSetInteger(0, name, OBJPROP_BGCOLOR,      bgClr);
   ObjectSetInteger(0, name, OBJPROP_BORDER_COLOR, borderClr);
}

//+------------------------------------------------------------------+
void DrawSep(string tag, int xx, int yy, int ww)
{
   DrawBG("sep_" + tag, xx, yy, ww, 1, C'45,55,70', C'45,55,70');
}

//+------------------------------------------------------------------+
string MakeBar(double pct)
{
   int len = 20;
   int filled = (int)MathRound(MathMin(MathMax(pct, 0.0), 100.0) / 100.0 * len);
   string b = "[";
   for(int i = 0; i < len; i++)
   {
      if(i < filled) b += "|";
      else           b += ".";
   }
   b += "]";
   return b;
}

//+------------------------------------------------------------------+
string TFName()
{
   int p = Period();
   if(p == PERIOD_M1)  return "M1";
   if(p == PERIOD_M5)  return "M5";
   if(p == PERIOD_M15) return "M15";
   if(p == PERIOD_M30) return "M30";
   if(p == PERIOD_H1)  return "H1";
   if(p == PERIOD_H4)  return "H4";
   if(p == PERIOD_D1)  return "D1";
   if(p == PERIOD_W1)  return "W1";
   if(p == PERIOD_MN1) return "MN";
   return "M" + IntegerToString(p);
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   for(int i = ObjectsTotal() - 1; i >= 0; i--)
   {
      string name = ObjectName(i);
      if(StringFind(name, PX) == 0) ObjectDelete(name);
   }
   Comment("");
}
//+------------------------------------------------------------------+