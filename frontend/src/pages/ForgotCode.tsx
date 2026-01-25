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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Mail, ChevronLeft, CheckCircle2 } from "lucide-react";

const forgotCodeSchema = z.object({
  email: z.string().email("Email inválido"),
});

type ForgotCodeForm = z.infer<typeof forgotCodeSchema>;

export default function ForgotCode() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  const form = useForm<ForgotCodeForm>({
    resolver: zodResolver(forgotCodeSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotCodeForm) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        setEmailSent(true);
        setIsRegistered(result.data.registered);
        
        toast({
          title: "Email Enviado!",
          description: result.data.message,
        });
      } else {
        toast({
          title: "Erro",
          description: result.error || "Erro ao enviar email",
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

  if (emailSent) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-primary/20">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl">Email Enviado!</CardTitle>
            <CardDescription>Verifique sua caixa de entrada</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <Alert>
              <Mail className="h-4 w-4" />
              <AlertTitle>Próximos Passos</AlertTitle>
              <AlertDescription>
                {isRegistered ? (
                  <ul className="list-disc list-inside space-y-1 text-sm mt-2">
                    <li>Verifique seu email</li>
                    <li>Se seu email não foi validado, clique no link de validação</li>
                    <li>Se já foi validado, use os códigos enviados para fazer login</li>
                  </ul>
                ) : (
                  <p className="text-sm mt-2">
                    Se este email estiver cadastrado, você receberá um email com instruções.
                    Caso contrário, você pode se cadastrar agora.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Link href="/login" className="w-full">
              <Button className="w-full">
                Ir para Login
              </Button>
            </Link>
            {!isRegistered && (
              <Link href="/register" className="w-full">
                <Button variant="outline" className="w-full">
                  Fazer Cadastro
                </Button>
              </Link>
            )}
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4 relative scientific-grid">
      <Link href="/login" className="absolute top-8 left-8 text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors">
        <ChevronLeft className="w-4 h-4" />
        Voltar
      </Link>
      
      <Card className="w-full max-w-md shadow-2xl border-t-4 border-t-primary">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <Mail className="w-8 h-8" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Esqueci meu Código</CardTitle>
          <CardDescription className="text-center">
            Digite seu email para receber seus códigos de acesso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="seu@email.com"
                        type="email"
                        className="h-12" 
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
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-5 w-5" />
                    Enviar Códigos
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 border-t pt-6">
          <div className="text-sm text-muted-foreground text-center">
            Lembrou do código?
            <Link href="/login" className="ml-1 text-primary hover:underline font-medium">
              Fazer Login
            </Link>
          </div>
          <div className="text-sm text-muted-foreground text-center">
            Não tem cadastro?
            <Link href="/register" className="ml-1 text-primary hover:underline font-medium">
              Cadastre-se
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
