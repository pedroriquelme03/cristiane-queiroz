#include <stdio.h>

#define TF 10

int main(void)
{
    float A[TF][TF], B[TF][TF], C[TF][TF];
    int TLl, TLc, i, j;

    printf("Informe o numero de linhas (TLl) e de colunas (TLc): ");
    if (scanf("%d %d", &TLl, &TLc) != 2)
    {
        printf("Entrada invalida.\n");
        return 1;
    }

    if (TLl < 1 || TLl > TF || TLc < 1 || TLc > TF)
    {
        printf("As dimensoes devem estar entre 1 e %d.\n", TF);
        return 1;
    }

    printf("Informe os elementos reais da matriz A (%d x %d):\n", TLl, TLc);
    for (i = 0; i < TLl; i++)
    {
        for (j = 0; j < TLc; j++)
        {
            if (scanf("%f", &A[i][j]) != 1)
            {
                printf("Entrada invalida na matriz A.\n");
                return 1;
            }
        }
    }

    printf("Informe os elementos reais da matriz B (%d x %d):\n", TLl, TLc);
    for (i = 0; i < TLl; i++)
    {
        for (j = 0; j < TLc; j++)
        {
            if (scanf("%f", &B[i][j]) != 1)
            {
                printf("Entrada invalida na matriz B.\n");
                return 1;
            }
        }
    }

    for (i = 0; i < TLl; i++)
    {
        for (j = 0; j < TLc; j++)
        {
            C[i][j] = A[i][j] + B[i][j];
        }
    }

    printf("Matriz soma C:\n");
    for (i = 0; i < TLl; i++)
    {
        for (j = 0; j < TLc; j++)
        {
            printf("%8.2f", C[i][j]);
        }
        printf("\n");
    }

    return 0;
}
