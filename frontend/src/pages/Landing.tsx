import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Fingerprint, ShieldCheck, ArrowRight } from "lucide-react";
import { useI18n } from "@/i18n/i18n";

export default function Landing() {
  const { t, setLanguage, language } = useI18n();

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden scientific-grid">
      {/* Abstract Background Decoration */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      
      <header className="container mx-auto px-4 py-6 flex justify-between items-center relative z-10">
        <div className="flex items-center gap-2 font-bold text-2xl tracking-tighter">
          <div className="bg-primary text-primary-foreground p-2 rounded-xl shadow-lg shadow-primary/20">
            <Fingerprint className="w-6 h-6" />
          </div>
          <span>{t('app.title').split(' ').slice(0, 3).join(' ')}<span className="text-primary">  </span><span className="text-primary">{t('app.title').split(' ').slice(3).join(' ')}</span></span>
        </div>
        <div className="flex gap-4 items-center">
          {/* Language Selector */}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
          >
            <option value="pt-BR">🇧🇷 Português</option>
            <option value="en">🇺🇸 English</option>
            <option value="es">🇪🇸 Español</option>
          </select>
          <Link href="/login">
            <Button variant="ghost" className="font-medium hover:bg-muted/50">
              {t('home.login')}
            </Button>
          </Link>
          <Link href="/register">
            <Button className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
              {t('home.register')}
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 flex flex-col justify-center items-center text-center relative z-10 py-20">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <ShieldCheck className="w-4 h-4" />
          <span style={{fontSize: '0.75rem'}}>{t('app.subtitle')}</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground max-w-4xl mb-6 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100" style={{fontSize: '3rem'}}>
          {t('home.title')}<br/>
          <span className="text-primary bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600" 
            style={{fontSize: '2.5rem'}}>
            {t('home.subtitle')}
          </span>
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
          {t('home.about_desc')}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
          <Link href="/register" className="w-full">
            <Button size="lg" className="w-full text-lg h-14 rounded-xl shadow-xl shadow-primary/25 hover:scale-[1.02] transition-transform">
              {t('home.new_participant')}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
          <Link href="/login" className="w-full">
            <Button size="lg" variant="outline" className="w-full text-lg h-14 rounded-xl hover:bg-muted/50">
              {t('home.returning')}
            </Button>
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-24 w-full max-w-5xl text-left animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500">
          <FeatureCard 
            title={t('home.feature1')}
            desc={t('home.feature1_desc')}
            delay="0ms"
          />
          <FeatureCard 
            title={t('home.feature2')}
            desc={t('home.feature2_desc')}
            delay="100ms"
          />
          <FeatureCard 
            title={t('home.feature3')}
            desc={t('home.feature3_desc')}
            delay="200ms"
          />
          <FeatureCard 
            title={t('home.feature4')}
            desc={t('home.feature4_desc')}
            delay="200ms"
          />
          <FeatureCard 
            title={t('home.feature5')}
            desc={t('home.feature5_desc')}
            delay="200ms"
          />
        </div>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground bg-white/50 backdrop-blur">
        <p>{t('app.footer')}</p>
        <div className="mt-4 pt-4 border-t border-border/50 max-w-2xl mx-auto">
          <p className="text-xs text-muted-foreground/80">
            Projeto desenvolvido com apoio da <strong>FAPEMIG</strong> e <strong>Rede Mineira de Ciências Forenses</strong>
          </p>
          <p className="text-xs text-muted-foreground/60 font-mono mt-1">RED-00120-23</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ title, desc, delay }: { title: string, desc: string, delay: string }) {
  return (
    <div className="p-6 rounded-2xl bg-white border border-border shadow-sm hover:shadow-md transition-shadow" style={{ transitionDelay: delay }}>
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-primary">
        <Fingerprint className="w-5 h-5" />
      </div>
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground leading-relaxed text-sm">{desc}</p>
    </div>
  );
}
