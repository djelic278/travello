import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FcGoogle } from "react-icons/fc";
import { Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function AuthPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (action: "login" | "register") => {
    try {
      // Implementacija klasične prijave/registracije će biti dodana kasnije
      toast({
        title: "Uspjeh",
        description: `${action === "login" ? "Prijava" : "Registracija"} uspješna`,
      });
    } catch (error: any) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      await signInWithGoogle();
      toast({
        title: "Uspješna prijava",
        description: "Dobrodošli u Travel Allowance System!",
      });
    } catch (error: any) {
      toast({
        title: "Greška pri prijavi",
        description: error.message || "Došlo je do problema prilikom prijave. Molimo pokušajte ponovno.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Travel Allowance System
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="login" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Prijava</TabsTrigger>
              <TabsTrigger value="register">Registracija</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Korisničko ime</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Lozinka</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => handleSubmit("login")}
              >
                Prijava
              </Button>
            </TabsContent>

            <TabsContent value="register" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reg-username">Korisničko ime</Label>
                <Input
                  id="reg-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password">Lozinka</Label>
                <Input
                  id="reg-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => handleSubmit("register")}
              >
                Registracija
              </Button>
            </TabsContent>
          </Tabs>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                ili se prijavite pomoću
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FcGoogle className="mr-2 h-5 w-5" />
            )}
            Prijavi se s Google računom
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}