import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useI18n } from "@/i18n/i18n";
import { useToast } from "@/components/ui/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, KeyRound, ChevronLeft } from "lucide-react";

const loginSchema = z.object({
  code: z.string().min(1, "Código é obrigatório"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      code: "",
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        localStorage.setItem("token", result.data.token);
        localStorage.setItem("participant", JSON.stringify(result.data.participant));
        toast({
          title: "Sucesso!",
          description: "Login realizado com sucesso",
        });
        setLocation("/dashboard");
      } else {
        toast({
          title: "Erro",
          description: result.error || "Código inválido",
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

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4 relative scientific-grid">
       <Link href="/" className="absolute top-8 left-8 text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors">
        <ChevronLeft className="w-4 h-4" />
        {t('common.back')}
      </Link>
      
      <Card className="w-full max-w-md shadow-2xl border-t-4 border-t-primary">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <KeyRound className="w-8 h-8" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">{t('login.title')}</CardTitle>
          <CardDescription className="text-center">
            {t('login.instruction')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('login.code')}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={t('login.code_placeholder')}
                        className="h-12 text-center text-lg font-mono tracking-widest uppercase" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full h-12 text-lg shadow-lg shadow-primary/20 hover:shadow-primary/30"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {t('login.processing')}
                  </>
                ) : (
                  t('login.submit')
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 border-t pt-6">
          <Link href="/forgot-code" className="text-sm text-primary hover:underline font-medium text-center">
            Esqueci meu código
          </Link>
          <div className="text-sm text-muted-foreground text-center">
            {t('login.help_text')}
            <Link href="/register" className="ml-1 text-primary hover:underline font-medium">
              {t('login.register')}
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
