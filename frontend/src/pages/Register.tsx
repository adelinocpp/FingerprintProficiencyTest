import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useI18n } from "@/i18n/i18n";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Fingerprint, ChevronLeft } from "lucide-react";

const registerFormSchema = z.object({
  voluntary_name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  voluntary_email: z.string().email("Email inválido"),
  terms_accepted: z.boolean().refine((val) => val === true, {
    message: "Você deve aceitar os termos",
  }),
});

type RegisterForm = z.infer<typeof registerFormSchema>;

export default function Register() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<{ voluntary_code: string; carry_code: string } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    // Verifica se há erro de validação vindo da URL
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    if (errorParam) {
      setValidationError(decodeURIComponent(errorParam));
      toast({
        title: "Erro na Validação de Email",
        description: decodeURIComponent(errorParam),
        variant: "destructive",
      });
      // Limpa o parâmetro da URL
      window.history.replaceState({}, '', '/register');
    }
  }, [toast]);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      voluntary_name: "",
      voluntary_email: "",
      terms_accepted: false,
    },
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        setGeneratedCodes({
          voluntary_code: result.data.voluntary_code,
          carry_code: result.data.carry_code,
        });
        
        if (result.data.already_registered) {
          toast({
            title: t('register.already_registered') || 'Email Já Cadastrado',
            description: result.data.message || t('register.codes_resent_message'),
            className: "bg-amber-50 border-amber-200",
          });
        } else {
          toast({
            title: t('register.success'),
            description: result.data.message || t('register.success_message'),
          });
        }
      } else {
        toast({
          title: "Erro",
          description: result.error || "Erro ao registrar",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao conectar com o servidor",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (generatedCodes) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-primary/20">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
              <Fingerprint className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl">{t('register.title')}</CardTitle>
            <CardDescription>{t('register.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            {validationError && (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Erro na Validação de Email</AlertTitle>
                <AlertDescription>{validationError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-6 pt-6">
              <div className="bg-muted p-6 rounded-xl border border-dashed border-primary/30 text-center">
                <p className="text-sm text-muted-foreground mb-2">{t('register.voluntary_code')}</p>
                <p className="text-4xl font-mono font-bold tracking-widest text-primary selection:bg-primary selection:text-white">
                  {generatedCodes.voluntary_code}
                </p>
              </div>
              <div className="bg-muted p-6 rounded-xl border border-dashed border-secondary/30 text-center">
                <p className="text-sm text-muted-foreground mb-2">{t('register.carry_code')}</p>
                <p className="text-3xl font-mono font-bold tracking-widest text-secondary-foreground selection:bg-secondary selection:text-white">
                  {generatedCodes.carry_code}
                </p>
              </div>
              <Alert>
                <AlertTitle>{t('register.important')}</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>{t('register.tip1')}</li>
                    <li>{t('register.tip2')}</li>
                    <li>{t('register.tip3')}</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
          <CardFooter>
            <Link href="/login" className="w-full">
              <Button className="w-full h-12 text-lg shadow-lg shadow-primary/20">
                {t('register.go_login')}
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4 relative scientific-grid">
      <Link href="/" className="absolute top-8 left-8 text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors">
        <ChevronLeft className="w-4 h-4" />
        {t('common.back')}
      </Link>

      <Card className="w-full max-w-lg shadow-2xl border-t-4 border-t-primary">
        <CardHeader>
          <CardTitle className="text-3xl">{t('register.title')}</CardTitle>
          <CardDescription className="text-base">
            {t('register.success_message')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {validationError && (
            <Alert variant="destructive" className="mb-6">
              <AlertTitle>Erro na Validação de Email</AlertTitle>
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="voluntary_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('register.name')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('register.name_placeholder')} className="h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="voluntary_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('register.email')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('register.email_placeholder')} type="email" className="h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="h-px bg-border my-6" />

              <div className="space-y-4">
                <h3 className="font-semibold text-sm">{t('register.terms')}</h3>
                <div className="h-32 overflow-y-auto text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg border border-border">
                  <p className="mb-2">1. {t('home.about_desc')}</p>
                  <p className="mb-2">2. {t('home.feature1')}</p>
                  <p className="mb-2">3. {t('home.feature2')}</p>
                  <p className="mb-2">4. {t('home.feature3')}</p>
                  <p>5. {t('home.feature4')}</p>
                </div>

                <FormField
                  control={form.control}
                  name="terms_accepted"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>{t('register.terms')}</FormLabel>
                        <FormDescription className="text-xs">
                          {t('register.accept_terms')}
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-lg shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all mt-6"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {t('register.processing')}
                  </>
                ) : (
                  t('register.submit')
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
